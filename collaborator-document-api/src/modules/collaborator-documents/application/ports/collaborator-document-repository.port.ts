import type {ResultAsync} from "neverthrow";

import type {TransactionContext} from "../../../../shared/application/ports/transaction-manager.js";
import type {CollaboratorDocumentsFailure} from "../contracts/soft-delete-collaborator-documents.input.js";

/** Porta de persistência pertencente ao módulo collaborator-documents. */
export interface CollaboratorDocumentRepository {
  softDeleteActiveByCollaboratorId(
    collaboratorId: string,
    deletedAt: Date,
    context: TransactionContext
  ): ResultAsync<void, CollaboratorDocumentsFailure>;
}
