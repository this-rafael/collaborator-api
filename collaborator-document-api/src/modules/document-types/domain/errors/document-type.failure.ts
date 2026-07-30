/**
 * Falhas modeladas pelo módulo document-types.
 * Dados discriminados consumidos via Result — sem throw de negócio.
 */
export type DocumentTypeDomainFailureCode = "VALIDATION_ERROR" | "DOCUMENT_TYPE_DELETED";

export type DocumentTypeApplicationFailureCode =
  | "DOCUMENT_TYPE_NOT_FOUND"
  | "DUPLICATE_ACTIVE_DOCUMENT_TYPE_CODE"
  | "INVALID_QUERY_PARAMETER"
  | "SERVICE_UNAVAILABLE"
  | "INTERNAL_SERVER_ERROR";

export type FieldError = Readonly<{field: string; code: string; message: string}>;

export type DocumentTypeDomainFailure = Readonly<{
  kind: "domain";
  code: DocumentTypeDomainFailureCode;
  message: string;
}>;

export type DocumentTypeApplicationFailure = Readonly<{
  kind: "application";
  code: DocumentTypeApplicationFailureCode;
  message: string;
  errors?: readonly FieldError[];
}>;

export type DocumentTypeFailure = DocumentTypeDomainFailure | DocumentTypeApplicationFailure;

export const documentTypeDomainFailure = (
  code: DocumentTypeDomainFailureCode,
  message: string
): DocumentTypeDomainFailure => ({kind: "domain", code, message});

export const documentTypeApplicationFailure = (
  code: DocumentTypeApplicationFailureCode,
  message: string,
  errors?: readonly FieldError[]
): DocumentTypeApplicationFailure =>
  errors?.length
    ? {kind: "application", code, message, errors}
    : {kind: "application", code, message};
