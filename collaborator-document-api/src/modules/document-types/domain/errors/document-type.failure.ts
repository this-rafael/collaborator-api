/**
 * Falhas modeladas pelo módulo document-types.
 * Dados discriminados consumidos via Result — sem throw de negócio.
 */
/** Código de falha de domínio para tipos de documento. */
export type DocumentTypeDomainFailureCode = "VALIDATION_ERROR" | "DOCUMENT_TYPE_DELETED";

/** Código de falha de aplicação para tipos de documento. */
export type DocumentTypeApplicationFailureCode =
  | "DOCUMENT_TYPE_NOT_FOUND"
  | "DUPLICATE_ACTIVE_DOCUMENT_TYPE_CODE"
  | "INVALID_QUERY_PARAMETER"
  | "SERVICE_UNAVAILABLE"
  | "INTERNAL_SERVER_ERROR";

/** Detalhe de erro com campo, código e mensagem. */
export type FieldError = Readonly<{field: string; code: string; message: string}>;

/** Falha de domínio no módulo de tipos de documento. */
export type DocumentTypeDomainFailure = Readonly<{
  kind: "domain";
  code: DocumentTypeDomainFailureCode;
  message: string;
}>;

/** Falha de aplicação no módulo de tipos de documento. */
export type DocumentTypeApplicationFailure = Readonly<{
  kind: "application";
  code: DocumentTypeApplicationFailureCode;
  message: string;
  errors?: readonly FieldError[];
}>;

/** União de todas as falhas possíveis do módulo de tipos de documento. */
export type DocumentTypeFailure = DocumentTypeDomainFailure | DocumentTypeApplicationFailure;

/**
 * Constrói uma falha de domínio para tipos de documento.
 *
 * @param code - Código da falha de domínio (por exemplo, `VALIDATION_ERROR` ou `DOCUMENT_TYPE_DELETED`).
 * @param message - Mensagem descritiva legível da falha.
 * @returns Falha de domínio imutável com `kind` igual a `"domain"`.
 */
export const documentTypeDomainFailure = (
  code: DocumentTypeDomainFailureCode,
  message: string
): DocumentTypeDomainFailure => ({kind: "domain", code, message});

/**
 * Constrói uma falha de aplicação para tipos de documento.
 *
 * @param code - Código da falha de aplicação (por exemplo, `DOCUMENT_TYPE_NOT_FOUND` ou `INTERNAL_SERVER_ERROR`).
 * @param message - Mensagem descritiva legível da falha.
 * @param errors - Lista opcional de erros por campo; incluída apenas quando não vazia.
 * @returns Falha de aplicação imutável com `kind` igual a `"application"`.
 */
export const documentTypeApplicationFailure = (
  code: DocumentTypeApplicationFailureCode,
  message: string,
  errors?: readonly FieldError[]
): DocumentTypeApplicationFailure =>
  errors?.length
    ? {kind: "application", code, message, errors}
    : {kind: "application", code, message};
