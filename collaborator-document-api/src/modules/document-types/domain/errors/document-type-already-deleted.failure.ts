import {
  documentTypeDomainFailure,
  type DocumentTypeDomainFailure
} from "./document-type.failure.js";

/** Falha de domínio quando se tenta excluir um tipo já excluído. */
export const documentTypeAlreadyDeletedFailure = (): DocumentTypeDomainFailure =>
  documentTypeDomainFailure("DOCUMENT_TYPE_DELETED", "Document type has already been deleted.");
