import type {Result} from "neverthrow";

import type {TransactionContext} from "../../../../shared/application/ports/transaction-manager.js";
import type {CollaboratorDocumentsFailure} from "../../../collaborator-documents/application/contracts/soft-delete-collaborator-documents.input.js";

export type SoftDeleteCollaboratorDocumentsByTypeInput = Readonly<{
  documentTypeId: string;
  deletedAt: string;
}>;

export interface CollaboratorDocumentsByTypePort {
  execute(
    input: SoftDeleteCollaboratorDocumentsByTypeInput,
    context: TransactionContext
  ): Promise<Result<void, CollaboratorDocumentsFailure>>;
}
