import {
  documentTypeApplicationFailure,
  type DocumentTypeApplicationFailure
} from "./document-type.failure.js";

export const documentTypeNotFoundFailure = (): DocumentTypeApplicationFailure =>
  documentTypeApplicationFailure("DOCUMENT_TYPE_NOT_FOUND", "Document type was not found.");
