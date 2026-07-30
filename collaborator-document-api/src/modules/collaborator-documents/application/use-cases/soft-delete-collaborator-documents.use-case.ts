import {errAsync, type ResultAsync} from "neverthrow";

import type {TransactionContext} from "../../../../shared/application/ports/transaction-manager.js";
import {
  collaboratorDocumentsFailure,
  type CollaboratorDocumentsFailure,
  type SoftDeleteCollaboratorDocumentsInput
} from "../contracts/soft-delete-collaborator-documents.input.js";
import type {CollaboratorDocumentRepository} from "../ports/collaborator-document-repository.port.js";

/**
 * API pública mínima do módulo collaborator-documents para a cascata de
 * exclusão. O módulo dono da coleção mantém a sua própria persistência.
 */
export class SoftDeleteCollaboratorDocumentsUseCase {
  constructor(private readonly repository: CollaboratorDocumentRepository) {}

  execute(
    input: SoftDeleteCollaboratorDocumentsInput,
    context: TransactionContext
  ): ResultAsync<void, CollaboratorDocumentsFailure> {
    if (!input || typeof input.collaboratorId !== "string" || typeof input.deletedAt !== "string") {
      return errAsync(
        collaboratorDocumentsFailure(
          "INTERNAL_SERVER_ERROR",
          "Invalid collaborator document cascade input."
        )
      );
    }
    const deletedAt = new Date(input.deletedAt);
    if (!input.collaboratorId || Number.isNaN(deletedAt.getTime())) {
      return errAsync(
        collaboratorDocumentsFailure(
          "INTERNAL_SERVER_ERROR",
          "Invalid collaborator document cascade input."
        )
      );
    }

    return this.repository.softDeleteActiveByCollaboratorId(
      input.collaboratorId,
      deletedAt,
      context
    );
  }
}
