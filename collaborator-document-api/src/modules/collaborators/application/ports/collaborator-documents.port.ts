import type {Result} from "neverthrow";

import type {TransactionContext} from "../../../../shared/application/ports/transaction-manager.js";
import type {
  CollaboratorDocumentsFailure,
  SoftDeleteCollaboratorDocumentsInput
} from "../../../collaborator-documents/application/contracts/soft-delete-collaborator-documents.input.js";

/** API pública mínima do módulo collaborator-documents consumida por collaborators. */
export interface CollaboratorDocumentsPort {
  execute(
    input: SoftDeleteCollaboratorDocumentsInput,
    context: TransactionContext
  ): Promise<Result<void, CollaboratorDocumentsFailure>>;
}
