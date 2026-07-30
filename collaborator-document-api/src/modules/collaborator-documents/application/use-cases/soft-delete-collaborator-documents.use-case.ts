import {err, type Result} from "neverthrow";

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

  async execute(
    input: SoftDeleteCollaboratorDocumentsInput,
    context: TransactionContext
  ): Promise<Result<void, CollaboratorDocumentsFailure>> {
    if (!input || typeof input.collaboratorId !== "string" || typeof input.deletedAt !== "string") {
      return err(
        collaboratorDocumentsFailure(
          "INTERNAL_SERVER_ERROR",
          "Invalid collaborator document cascade input."
        )
      );
    }
    const deletedAt = new Date(input.deletedAt);
    if (!input.collaboratorId || Number.isNaN(deletedAt.getTime())) {
      return err(
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
