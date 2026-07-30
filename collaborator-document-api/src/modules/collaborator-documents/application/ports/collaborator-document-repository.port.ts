import type {Result} from "neverthrow";

import type {TransactionContext} from "../../../../shared/application/ports/transaction-manager.js";
import type {CollaboratorDocument} from "../../domain/aggregates/collaborator-document.js";
import type {CollaboratorDocumentFailure} from "../../domain/errors/collaborator-document.failure.js";
import type {CollaboratorDocumentsFailure} from "../contracts/soft-delete-collaborator-documents.input.js";
import type {CollaboratorDocumentOutput} from "../contracts/collaborator-document-output.js";

/** Filtros normalizados de listagem. */
export type CollaboratorDocumentListFilters = Readonly<{
  collaboratorId?: string;
  documentTypeId?: string;
  status?: "PENDING" | "SUBMITTED";
  lifecycle: "active" | "unlinked" | "deleted" | "all";
}>;

/** Página retornada pela listagem keyset. */
export type CollaboratorDocumentListPage = Readonly<{
  items: readonly CollaboratorDocumentOutput[];
  hasNext: boolean;
}>;

/** Porta de persistência do módulo collaborator-documents. */
export interface CollaboratorDocumentRepository {
  softDeleteActiveByCollaboratorId(
    collaboratorId: string,
    deletedAt: Date,
    context: TransactionContext
  ): Promise<Result<void, CollaboratorDocumentsFailure>>;
  softDeleteActiveByDocumentTypeId(
    documentTypeId: string,
    deletedAt: Date,
    context: TransactionContext
  ): Promise<Result<void, CollaboratorDocumentsFailure>>;
  create(
    document: CollaboratorDocument
  ): Promise<Result<CollaboratorDocumentOutput, CollaboratorDocumentFailure>>;
  findById(id: string): Promise<Result<CollaboratorDocumentOutput, CollaboratorDocumentFailure>>;
  list(input: {
    filters: CollaboratorDocumentListFilters;
    afterId?: string;
    limit: number;
  }): Promise<Result<CollaboratorDocumentListPage, CollaboratorDocumentFailure>>;
  unlinkActive(
    id: string,
    unlinkedAt: Date,
    updatedAt: Date
  ): Promise<Result<void, CollaboratorDocumentFailure>>;
}
