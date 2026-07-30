import {
  documentTypeApplicationFailure,
  type DocumentTypeApplicationFailure
} from "./document-type.failure.js";

/** Falha de aplicação quando um tipo de documento não é encontrado. */
export const documentTypeNotFoundFailure = (): DocumentTypeApplicationFailure =>
  documentTypeApplicationFailure("DOCUMENT_TYPE_NOT_FOUND", "Document type was not found.");
