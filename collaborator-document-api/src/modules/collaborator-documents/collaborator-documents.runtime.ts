import {Injectable} from "@tsed/di";
import {err, type Result} from "neverthrow";

import type {TransactionContext} from "../../shared/application/ports/transaction-manager.js";
import type {
  CollaboratorDocumentsFailure,
  SoftDeleteCollaboratorDocumentsInput
} from "./application/contracts/soft-delete-collaborator-documents.input.js";
import {collaboratorDocumentsFailure} from "./application/contracts/soft-delete-collaborator-documents.input.js";
import {SoftDeleteCollaboratorDocumentsUseCase} from "./application/use-cases/soft-delete-collaborator-documents.use-case.js";
import {MongoCollaboratorDocumentRepository} from "./infrastructure/persistence/mongodb/collaborator-document.mongo-repository.js";

/**
 * Superfície pública do módulo collaborator-documents para composições entre
 * módulos. O repositório Mongo permanece encapsulado no módulo proprietário.
 */
@Injectable()
export class CollaboratorDocumentsRuntime {
  private readonly softDelete: SoftDeleteCollaboratorDocumentsUseCase;

  constructor(private readonly repository: MongoCollaboratorDocumentRepository) {
    this.softDelete = new SoftDeleteCollaboratorDocumentsUseCase(repository);
  }

  async execute(
    input: SoftDeleteCollaboratorDocumentsInput,
    context: TransactionContext
  ): Promise<Result<void, CollaboratorDocumentsFailure>> {
    return this.softDelete.execute(input, context);
  }

  async executeByDocumentType(
    input: Readonly<{documentTypeId: string; deletedAt: string}>,
    context: TransactionContext
  ): Promise<Result<void, CollaboratorDocumentsFailure>> {
    if (!input || typeof input.documentTypeId !== "string" || typeof input.deletedAt !== "string") {
      return err(
        collaboratorDocumentsFailure(
          "INTERNAL_SERVER_ERROR",
          "Invalid collaborator document cascade input."
        )
      );
    }
    const deletedAt = new Date(input.deletedAt);
    if (!input.documentTypeId || Number.isNaN(deletedAt.getTime())) {
      return err(
        collaboratorDocumentsFailure(
          "INTERNAL_SERVER_ERROR",
          "Invalid collaborator document cascade input."
        )
      );
    }
    return this.repository.softDeleteActiveByDocumentTypeId(
      input.documentTypeId,
      deletedAt,
      context
    );
  }
}
