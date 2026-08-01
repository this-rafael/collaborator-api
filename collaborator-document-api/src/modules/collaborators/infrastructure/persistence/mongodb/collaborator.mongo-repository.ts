/**
 * Adaptador MongoDB do repositório de colaboradores.
 *
 * Implementa a porta de domínio traduzindo erros do driver em falhas do módulo,
 * garantindo a unicidade de CPF e e-mail apenas entre colaboradores ativos e
 * participando das transações coordenadas pela aplicação.
 */
import {Injectable} from "@tsed/di";
import {MongooseService} from "@tsed/mongoose";
import {err, ok, type Result} from "neverthrow";
import {Types, type Connection} from "mongoose";

import type {
  CollaboratorListPage,
  CollaboratorRepository
} from "../../../domain/repositories/collaborator.repository.js";
import type {TransactionContext} from "../../../../../shared/domain/transaction-context.js";
import {Collaborator} from "../../../domain/entities/collaborator.js";
import {
  collaboratorApplicationFailure,
  collaboratorDomainFailure,
  type CollaboratorFailure
} from "../../../domain/errors/collaborator.failure.js";
import {getMongoSession} from "../../../../../shared/infrastructure/persistence/mongodb/mongo-transaction-context.js";
import {
  collaboratorFromMongoDocument,
  collaboratorToMongoDocument,
  normalizeCollaboratorName,
  type CollaboratorMongoRead
} from "./collaborator.mongo-mapper.js";
import {getCollaboratorMongoModel} from "./collaborator.mongo-document.js";

const unavailable = (): CollaboratorFailure =>
  collaboratorApplicationFailure("SERVICE_UNAVAILABLE", "Collaborator persistence is unavailable.");

/** Adaptador MongoDB do repositório, isolado da aplicação por uma porta abstrata. */
@Injectable()
export class MongoCollaboratorRepository implements CollaboratorRepository {
  constructor(private readonly mongoose: MongooseService) {}

  create(collaborator: Collaborator): Promise<Result<Collaborator, CollaboratorFailure>> {
    return this.createSafely(collaborator);
  }

  findById(id: string): Promise<Result<Collaborator, CollaboratorFailure>> {
    return this.findByIdSafely(id);
  }

  listActive(input: {
    filters: {name?: string; cpf?: string; email?: string};
    afterId?: string;
    limit: number;
  }): Promise<Result<CollaboratorListPage, CollaboratorFailure>> {
    return this.listActiveSafely(input);
  }

  updateActive(collaborator: Collaborator): Promise<Result<Collaborator, CollaboratorFailure>> {
    return this.updateActiveSafely(collaborator);
  }

  softDeleteActive(
    collaborator: Collaborator,
    context: TransactionContext
  ): Promise<Result<boolean, CollaboratorFailure>> {
    return this.softDeleteActiveSafely(collaborator, context);
  }

  private connection(): Connection | undefined {
    try {
      const connection = this.mongoose.get();
      return connection?.readyState === 1 ? connection : undefined;
    } catch {
      return undefined;
    }
  }

  private async createSafely(
    collaborator: Collaborator
  ): Promise<Result<Collaborator, CollaboratorFailure>> {
    const model = this.model();
    const document = collaboratorToMongoDocument(collaborator);
    if (!model) return err(unavailable());
    if (document.isErr()) return err(document.error);

    try {
      const created = await model.create(document.value);
      return collaboratorFromMongoDocument(created.toObject() as CollaboratorMongoRead);
    } catch (error) {
      return err(mapMongoFailure(error));
    }
  }

  private async findByIdSafely(id: string): Promise<Result<Collaborator, CollaboratorFailure>> {
    const model = this.model();
    if (!model) return err(unavailable());
    if (!Types.ObjectId.isValid(id)) {
      return err(collaboratorDomainFailure("VALIDATION_ERROR", "collaborator id is invalid"));
    }

    try {
      const row = await model.findById(id).lean();
      return row
        ? collaboratorFromMongoDocument(row as CollaboratorMongoRead)
        : err(
            collaboratorApplicationFailure("COLLABORATOR_NOT_FOUND", "Collaborator was not found.")
          );
    } catch (error) {
      return err(mapMongoFailure(error));
    }
  }

  private async listActiveSafely(input: {
    filters: {name?: string; cpf?: string; email?: string};
    afterId?: string;
    limit: number;
  }): Promise<Result<CollaboratorListPage, CollaboratorFailure>> {
    const model = this.model();
    if (!model) return err(unavailable());
    if (input.afterId && !Types.ObjectId.isValid(input.afterId)) {
      return err(
        collaboratorApplicationFailure("INVALID_QUERY_PARAMETER", "cursor position is invalid")
      );
    }

    try {
      const filter: Record<string, unknown> = {deletedAt: null};
      if (input.filters.name) {
        filter.nameNormalized = {
          $regex: escapeRegex(normalizeCollaboratorName(input.filters.name))
        };
      }
      if (input.filters.cpf) filter.cpf = input.filters.cpf;
      if (input.filters.email) filter.email = input.filters.email;
      if (input.afterId) filter._id = {$gt: new Types.ObjectId(input.afterId)};

      const rows = await model
        .find(filter)
        .sort({_id: 1})
        .limit(input.limit + 1)
        .lean();
      const mapped: Collaborator[] = [];
      for (const row of rows.slice(0, input.limit)) {
        const collaborator = collaboratorFromMongoDocument(row as CollaboratorMongoRead);
        if (collaborator.isErr()) return err(collaborator.error);
        mapped.push(collaborator.value);
      }

      return ok({items: mapped, hasNext: rows.length > input.limit});
    } catch (error) {
      return err(mapMongoFailure(error));
    }
  }

  private async updateActiveSafely(
    collaborator: Collaborator
  ): Promise<Result<Collaborator, CollaboratorFailure>> {
    const model = this.model();
    const document = collaboratorToMongoDocument(collaborator);
    if (!model) return err(unavailable());
    if (document.isErr()) return err(document.error);

    try {
      const row = await model
        .findOneAndUpdate(
          {_id: document.value._id, deletedAt: null},
          {
            $set: {
              name: document.value.name,
              nameNormalized: document.value.nameNormalized,
              cpf: document.value.cpf,
              email: document.value.email,
              updatedAt: document.value.updatedAt
            }
          },
          {returnDocument: "after", runValidators: true}
        )
        .lean();
      if (row) return collaboratorFromMongoDocument(row as CollaboratorMongoRead);

      const existing = await model.findById(document.value._id).select({deletedAt: 1}).lean();
      if (existing?.deletedAt) {
        return err(
          collaboratorDomainFailure(
            "COLLABORATOR_DELETED",
            "Collaborator has already been deleted."
          )
        );
      }
      return err(
        collaboratorApplicationFailure("COLLABORATOR_NOT_FOUND", "Collaborator was not found.")
      );
    } catch (error) {
      return err(mapMongoFailure(error));
    }
  }

  private async softDeleteActiveSafely(
    collaborator: Collaborator,
    context: TransactionContext
  ): Promise<Result<boolean, CollaboratorFailure>> {
    const model = this.model();
    const document = collaboratorToMongoDocument(collaborator);
    const session = getMongoSession(context);
    if (!model || !session) return err(unavailable());
    if (document.isErr()) return err(document.error);

    try {
      const result = await model.updateOne(
        {_id: document.value._id, deletedAt: null},
        {$set: {deletedAt: document.value.deletedAt, updatedAt: document.value.updatedAt}},
        {session}
      );
      return ok(result.modifiedCount === 1);
    } catch (error) {
      return err(mapMongoFailure(error));
    }
  }

  private model() {
    const connection = this.connection();
    if (!connection) return undefined;
    try {
      return getCollaboratorMongoModel(connection);
    } catch {
      return undefined;
    }
  }
}

function mapMongoFailure(error: unknown): CollaboratorFailure {
  const key = (error as {keyPattern?: Record<string, number>}).keyPattern;
  if (key?.cpf) {
    return collaboratorApplicationFailure(
      "DUPLICATE_ACTIVE_CPF",
      "An active collaborator already uses this CPF."
    );
  }
  if (key?.email) {
    return collaboratorApplicationFailure(
      "DUPLICATE_ACTIVE_EMAIL",
      "An active collaborator already uses this email."
    );
  }

  const name = (error as {name?: string})?.name ?? "";
  if (/serverselection|network|timeout/i.test(name)) return unavailable();
  return collaboratorApplicationFailure(
    "INTERNAL_SERVER_ERROR",
    "Collaborator persistence failed."
  );
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}
