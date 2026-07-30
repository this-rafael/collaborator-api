import {Injectable} from "@tsed/di";
import {MongooseService} from "@tsed/mongoose";
import type {ClientSession} from "mongoose";
import {err, ok, type Result} from "neverthrow";

import {applicationFailure} from "../../../application/errors/application-failure.js";
import type {
  TransactionContext,
  TransactionFailure,
  TransactionManager
} from "../../../application/ports/transaction-manager.js";
import {createMongoTransactionContext} from "./mongo-transaction-context.js";

const MAX_ATTEMPTS = 3;

/** Categorias relevantes de erro retornado pelo driver MongoDB. */
export type MongoTransactionErrorKind = "TRANSIENT" | "UNKNOWN_COMMIT" | "OTHER";

/** Classifica labels de erro sem expor o tipo técnico à aplicação. */
export function classifyMongoTransactionError(error: unknown): MongoTransactionErrorKind {
  const candidate = error as {hasErrorLabel?: (label: string) => boolean};
  if (candidate?.hasErrorLabel?.("TransientTransactionError")) return "TRANSIENT";
  if (candidate?.hasErrorLabel?.("UnknownTransactionCommitResult")) return "UNKNOWN_COMMIT";
  return "OTHER";
}

/**
 * Adaptador transacional MongoDB injetável pelo Ts.ED.
 *
 * A sessão Mongoose nunca cruza a porta de aplicação: o callback recebe um
 * `TransactionContext` opaco e retorna `Promise<Result>`. Erros técnicos são
 * convertidos para `TransactionFailure`, inclusive durante cleanup.
 */
@Injectable()
export class MongoTransactionManager implements TransactionManager {
  private retries = 0;

  constructor(private readonly mongooseService: MongooseService) {}

  get mongoTransactionRetriesTotal(): number {
    return this.retries;
  }

  execute<T, E>(
    work: (context: TransactionContext) => Promise<Result<T, E>>
  ): Promise<Result<T, E | TransactionFailure>> {
    return this.executeSafely(work);
  }

  private async executeSafely<T, E>(
    work: (context: TransactionContext) => Promise<Result<T, E>>
  ): Promise<Result<T, E | TransactionFailure>> {
    let session: ClientSession;
    try {
      const connection = this.mongooseService.get();
      if (connection?.readyState !== 1) {
        return err(this.unavailableFailure());
      }
      session = await connection.startSession();
    } catch (error) {
      return err(this.technicalFailure(error));
    }

    try {
      return await this.runAttempts(session, work);
    } finally {
      await this.endSession(session);
    }
  }

  private async runAttempts<T, E>(
    session: ClientSession,
    work: (context: TransactionContext) => Promise<Result<T, E>>
  ): Promise<Result<T, E | TransactionFailure>> {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        session.startTransaction({
          readPreference: "primary",
          readConcern: {level: "snapshot"},
          writeConcern: {w: "majority"},
          maxCommitTimeMS: 5_000
        });

        const result = await work(createMongoTransactionContext(session));
        if (result.isErr()) {
          await this.abort(session);
          return err(result.error);
        }

        const committed = await this.commitWithRetry(session);
        if (committed.isErr()) {
          await this.abort(session);
          return err(committed.error);
        }
        return ok(result.value);
      } catch (error) {
        await this.abort(session);
        if (classifyMongoTransactionError(error) === "TRANSIENT" && attempt < MAX_ATTEMPTS) {
          this.retries += 1;
          continue;
        }
        return err(this.technicalFailure(error));
      }
    }

    return err(this.unavailableFailure());
  }

  private async commitWithRetry(session: ClientSession): Promise<Result<void, TransactionFailure>> {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        await session.commitTransaction();
        return ok(undefined);
      } catch (error) {
        if (classifyMongoTransactionError(error) === "UNKNOWN_COMMIT" && attempt < MAX_ATTEMPTS) {
          this.retries += 1;
          continue;
        }
        return err(this.technicalFailure(error));
      }
    }

    return err(this.unavailableFailure());
  }

  private async abort(session: ClientSession): Promise<void> {
    try {
      if (session.inTransaction()) await session.abortTransaction();
    } catch {
      // O erro original já é representado pelo Result retornado ao caso de uso.
    }
  }

  private async endSession(session: ClientSession): Promise<void> {
    try {
      await session.endSession();
    } catch {
      // Cleanup não deve transformar uma falha modelada em exceção escapada.
    }
  }

  private technicalFailure(error: unknown): TransactionFailure {
    const name = error instanceof Error ? error.name : "";
    const message = error instanceof Error ? error.message : "";
    const unavailable =
      classifyMongoTransactionError(error) !== "OTHER" ||
      /Mongo(?:ServerSelection|Network|Timeout)|connection|network|timed out/i.test(
        `${name} ${message}`
      );
    return unavailable
      ? this.unavailableFailure()
      : applicationFailure("INTERNAL_SERVER_ERROR", "Não foi possível concluir a transação.");
  }

  private unavailableFailure(): TransactionFailure {
    return applicationFailure("SERVICE_UNAVAILABLE", "MongoDB está temporariamente indisponível.");
  }
}
