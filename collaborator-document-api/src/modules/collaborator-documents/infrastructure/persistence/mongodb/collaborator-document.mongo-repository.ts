import {Injectable} from "@tsed/di";
import {MongooseService} from "@tsed/mongoose";
import {err, ok, type Result, ResultAsync} from "neverthrow";

import type {TransactionContext} from "../../../../../shared/application/ports/transaction-manager.js";
import {getMongoSession} from "../../../../../shared/infrastructure/persistence/mongodb/mongo-transaction-context.js";
import {
  collaboratorDocumentsFailure,
  type CollaboratorDocumentsFailure
} from "../../../application/contracts/soft-delete-collaborator-documents.input.js";
import type {CollaboratorDocumentRepository} from "../../../application/ports/collaborator-document-repository.port.js";

/** Persistência Mongo pertencente ao módulo collaborator-documents. */
@Injectable()
export class MongoCollaboratorDocumentRepository implements CollaboratorDocumentRepository {
  constructor(private readonly mongoose: MongooseService) {}

  softDeleteActiveByCollaboratorId(
    collaboratorId: string,
    deletedAt: Date,
    context: TransactionContext
  ): ResultAsync<void, CollaboratorDocumentsFailure> {
    return ResultAsync.fromSafePromise(
      this.softDeleteActiveByCollaboratorIdSafely(collaboratorId, deletedAt, context)
    ).andThen((result) => result);
  }

  private async softDeleteActiveByCollaboratorIdSafely(
    collaboratorId: string,
    deletedAt: Date,
    context: TransactionContext
  ): Promise<Result<void, CollaboratorDocumentsFailure>> {
    const session = getMongoSession(context);
    if (!session) {
      return err(
        collaboratorDocumentsFailure(
          "SERVICE_UNAVAILABLE",
          "Collaborator document persistence is unavailable."
        )
      );
    }

    try {
      const database = this.mongoose.get()?.db;
      if (!database) {
        return err(
          collaboratorDocumentsFailure(
            "SERVICE_UNAVAILABLE",
            "Collaborator document persistence is unavailable."
          )
        );
      }
      await database
        .collection("collaborator_documents")
        .updateMany({collaboratorId, deletedAt: null}, {$set: {deletedAt}}, {session});
      return ok(undefined);
    } catch {
      return err(
        collaboratorDocumentsFailure(
          "INTERNAL_SERVER_ERROR",
          "Collaborator document cascade failed."
        )
      );
    }
  }
}
