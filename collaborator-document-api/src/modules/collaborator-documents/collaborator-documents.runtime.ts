import {Injectable} from "@tsed/di";

import type {TransactionContext} from "../../shared/application/ports/transaction-manager.js";
import type {
  CollaboratorDocumentsFailure,
  SoftDeleteCollaboratorDocumentsInput
} from "./application/contracts/soft-delete-collaborator-documents.input.js";
import {SoftDeleteCollaboratorDocumentsUseCase} from "./application/use-cases/soft-delete-collaborator-documents.use-case.js";
import {MongoCollaboratorDocumentRepository} from "./infrastructure/persistence/mongodb/collaborator-document.mongo-repository.js";
import type {ResultAsync} from "neverthrow";

/**
 * Superfície pública do módulo collaborator-documents para composições entre
 * módulos. O repositório Mongo permanece encapsulado no módulo proprietário.
 */
@Injectable()
export class CollaboratorDocumentsRuntime {
  private readonly softDelete: SoftDeleteCollaboratorDocumentsUseCase;

  constructor(repository: MongoCollaboratorDocumentRepository) {
    this.softDelete = new SoftDeleteCollaboratorDocumentsUseCase(repository);
  }

  execute(
    input: SoftDeleteCollaboratorDocumentsInput,
    context: TransactionContext
  ): ResultAsync<void, CollaboratorDocumentsFailure> {
    return this.softDelete.execute(input, context);
  }
}
