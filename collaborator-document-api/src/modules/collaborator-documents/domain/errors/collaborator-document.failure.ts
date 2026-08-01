/**
 * Falhas modeladas pelo módulo collaborator-documents.
 * Dados discriminados consumidos via Result — sem throw de negócio.
 */

/** Código de falha de domínio. */
export type CollaboratorDocumentDomainFailureCode = "VALIDATION_ERROR";

/** Código de falha de aplicação. */
export type CollaboratorDocumentApplicationFailureCode =
  | "ACTIVE_LINK_ALREADY_EXISTS"
  | "COLLABORATOR_DOCUMENT_DELETED"
  | "COLLABORATOR_DOCUMENT_NOT_FOUND"
  | "COLLABORATOR_DOCUMENT_UNLINKED"
  | "COLLABORATOR_DELETED"
  | "COLLABORATOR_NOT_FOUND"
  | "DOCUMENT_TYPE_DELETED"
  | "DOCUMENT_TYPE_NOT_FOUND"
  | "DOCUMENT_HISTORY_LIMIT_REACHED"
  | "DOCUMENT_VERSION_NOT_FOUND"
  | "INVALID_QUERY_PARAMETER"
  | "SERVICE_UNAVAILABLE"
  | "INTERNAL_SERVER_ERROR";

/** Detalhe de erro com campo, código e mensagem. */
export type FieldError = Readonly<{field: string; code: string; message: string}>;

/** Falha de domínio. */
export type CollaboratorDocumentDomainFailure = Readonly<{
  kind: "domain";
  code: CollaboratorDocumentDomainFailureCode;
  message: string;
}>;

/** Falha de aplicação. */
export type CollaboratorDocumentApplicationFailure = Readonly<{
  kind: "application";
  code: CollaboratorDocumentApplicationFailureCode;
  message: string;
  errors?: readonly FieldError[];
}>;

/** União de falhas do módulo. */
export type CollaboratorDocumentFailure =
  CollaboratorDocumentDomainFailure | CollaboratorDocumentApplicationFailure;

/**
 * Cria uma falha de domínio discriminada.
 *
 * @param code - Código da falha de domínio (ex.: VALIDATION_ERROR).
 * @param message - Mensagem legível descrevendo a violação de invariante.
 * @returns Falha de domínio pronta para uso em um `Result`.
 */
export const collaboratorDocumentDomainFailure = (
  code: CollaboratorDocumentDomainFailureCode,
  message: string
): CollaboratorDocumentDomainFailure => ({kind: "domain", code, message});

/**
 * Cria uma falha de aplicação discriminada.
 *
 * @param code - Código da falha de aplicação (ex.: NOT_FOUND, ACTIVE_LINK_ALREADY_EXISTS).
 * @param message - Mensagem legível descrevendo o problema.
 * @param errors - Lista opcional de erros por campo; omitida quando vazia.
 * @returns Falha de aplicação pronta para uso em um `Result`.
 */
export const collaboratorDocumentApplicationFailure = (
  code: CollaboratorDocumentApplicationFailureCode,
  message: string,
  errors?: readonly FieldError[]
): CollaboratorDocumentApplicationFailure =>
  errors?.length
    ? {kind: "application", code, message, errors}
    : {kind: "application", code, message};
