import type {Result} from "neverthrow";

import type {TransactionContext} from "../../../../shared/application/ports/transaction-manager.js";
import type {CollaboratorDocumentsFailure} from "../../../collaborator-documents/application/contracts/soft-delete-collaborator-documents.input.js";

/** Entrada para exclusão em cascata de documentos vinculados a um tipo. */
export type SoftDeleteCollaboratorDocumentsByTypeInput = Readonly<{
  documentTypeId: string;
  deletedAt: string;
}>;

/** Porta para exclusão em cascata de documentos ao excluir um tipo. */
export interface CollaboratorDocumentsByTypePort {
  execute(
    input: SoftDeleteCollaboratorDocumentsByTypeInput,
    context: TransactionContext
  ): Promise<Result<void, CollaboratorDocumentsFailure>>;
}
