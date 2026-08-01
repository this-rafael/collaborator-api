import {
  documentTypeDomainFailure,
  type DocumentTypeDomainFailure
} from "./document-type.failure.js";

/**
 * Cria a falha de domínio emitida ao tentar excluir ou atualizar um tipo de
 * documento que já sofreu soft delete.
 *
 * @returns Falha de domínio com código `DOCUMENT_TYPE_DELETED`.
 */
export const documentTypeAlreadyDeletedFailure = (): DocumentTypeDomainFailure =>
  documentTypeDomainFailure("DOCUMENT_TYPE_DELETED", "Document type has already been deleted.");
