import {
  documentTypeApplicationFailure,
  type DocumentTypeApplicationFailure
} from "./document-type.failure.js";

/**
 * Cria a falha de aplicação emitida quando um tipo de documento ativo não é
 * localizado pelo identificador informado.
 *
 * @returns Falha de aplicação com código `DOCUMENT_TYPE_NOT_FOUND`.
 */
export const documentTypeNotFoundFailure = (): DocumentTypeApplicationFailure =>
  documentTypeApplicationFailure("DOCUMENT_TYPE_NOT_FOUND", "Document type was not found.");
