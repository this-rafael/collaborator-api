import type {ResultAsync} from "neverthrow";

import type {TransactionContext} from "../../../../shared/domain/transaction-context.js";
import type {DocumentType} from "../entities/document-type.js";
import type {DocumentTypeFailure} from "../errors/document-type.failure.js";

export type DocumentTypeListFilters = Readonly<{name?: string; code?: string}>;

export type DocumentTypeListPage = Readonly<{
  items: readonly DocumentType[];
  hasNext: boolean;
}>;

export interface DocumentTypeRepository {
  create(documentType: DocumentType): ResultAsync<DocumentType, DocumentTypeFailure>;
  findById(id: string): ResultAsync<DocumentType, DocumentTypeFailure>;
  listActive(input: {
    filters: DocumentTypeListFilters;
    afterId?: string;
    limit: number;
  }): ResultAsync<DocumentTypeListPage, DocumentTypeFailure>;
  updateActive(documentType: DocumentType): ResultAsync<DocumentType, DocumentTypeFailure>;
  softDeleteActive(
    documentType: DocumentType,
    context: TransactionContext
  ): ResultAsync<boolean, DocumentTypeFailure>;
}
