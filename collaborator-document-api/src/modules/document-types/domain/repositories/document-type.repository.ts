import type {Result} from "neverthrow";

import type {TransactionContext} from "../../../../shared/domain/transaction-context.js";
import type {DocumentType} from "../entities/document-type.js";
import type {DocumentTypeFailure} from "../errors/document-type.failure.js";

/** Filtros normalizados para listagem de tipos de documento. */
export type DocumentTypeListFilters = Readonly<{name?: string; code?: string}>;

/** Página de resultados de listagem de tipos de documento. */
export type DocumentTypeListPage = Readonly<{
  items: readonly DocumentType[];
  hasNext: boolean;
}>;

/** Contrato de persistência para o agregado de tipo de documento. */
export interface DocumentTypeRepository {
  create(documentType: DocumentType): Promise<Result<DocumentType, DocumentTypeFailure>>;
  findById(id: string): Promise<Result<DocumentType, DocumentTypeFailure>>;
  listActive(input: {
    filters: DocumentTypeListFilters;
    afterId?: string;
    limit: number;
  }): Promise<Result<DocumentTypeListPage, DocumentTypeFailure>>;
  updateActive(documentType: DocumentType): Promise<Result<DocumentType, DocumentTypeFailure>>;
  softDeleteActive(
    documentType: DocumentType,
    context: TransactionContext
  ): Promise<Result<boolean, DocumentTypeFailure>>;
}
