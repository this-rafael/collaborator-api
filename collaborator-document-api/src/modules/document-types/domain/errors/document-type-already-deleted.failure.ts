import {
  documentTypeDomainFailure,
  type DocumentTypeDomainFailure
} from "./document-type.failure.js";

export const documentTypeAlreadyDeletedFailure = (): DocumentTypeDomainFailure =>
  documentTypeDomainFailure("DOCUMENT_TYPE_DELETED", "Document type has already been deleted.");
