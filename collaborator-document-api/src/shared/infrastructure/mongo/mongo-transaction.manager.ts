import type {ClientSession, Connection} from "mongoose";

import {requireMongooseConnection} from "./mongoose-connection.js";

/**
 * Categorias de erro em transações MongoDB.
 */
export type MongoTransactionErrorKind = "TRANSIENT" | "UNKNOWN_COMMIT" | "OTHER";

/**
 * Classifica um erro de transação MongoDB baseado nos
 * labels da exceção do driver.
 *
 * @param error - Erro capturado durante a transação.
 * @returns Categoria do erro.
 */
export function classifyMongoTransactionError(error: unknown): MongoTransactionErrorKind {
  const candidate = error as {hasErrorLabel?: (label: string) => boolean};
  if (candidate?.hasErrorLabel?.("TransientTransactionError")) return "TRANSIENT";
  if (candidate?.hasErrorLabel?.("UnknownTransactionCommitResult")) return "UNKNOWN_COMMIT";
  return "OTHER";
}

/**
 * Gerenciador de transações MongoDB com retry automático.
 *
 * Executa uma função de trabalho dentro de uma transação
 * com tentativas (até 3) para erros transitórios e de
 * commit desconhecido.
 */
export class MongoTransactionManager {
  private retries = 0;

  constructor(private readonly connectionOverride?: Connection) {}

  get mongoTransactionRetriesTotal(): number {
    return this.retries;
  }

  private connection(): Connection {
    return this.connectionOverride ?? requireMongooseConnection();
  }

  async runInTransaction<T>(work: (session: ClientSession) => Promise<T>): Promise<T> {
    const session = await this.connection().startSession();
    try {
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          session.startTransaction({
            readPreference: "primary",
            readConcern: {level: "snapshot"},
            writeConcern: {w: "majority"},
            maxCommitTimeMS: 5_000
          });
          const result = await work(session);
          await this.commitWithRetry(session);
          return result;
        } catch (error) {
          if (session.inTransaction()) await session.abortTransaction();
          if (classifyMongoTransactionError(error) !== "TRANSIENT" || attempt === 3) throw error;
          this.retries += 1;
        }
      }
      throw new Error("Transaction retries exhausted");
    } finally {
      await session.endSession();
    }
  }

  private async commitWithRetry(session: ClientSession): Promise<void> {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        await session.commitTransaction();
        return;
      } catch (error) {
        if (classifyMongoTransactionError(error) !== "UNKNOWN_COMMIT" || attempt === 3) throw error;
        this.retries += 1;
      }
    }
  }
}
