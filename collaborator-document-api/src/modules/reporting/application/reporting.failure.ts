export type ReportingFailureCode =
  "INVALID_QUERY_PARAMETER" | "INTERNAL_SERVER_ERROR" | "SERVICE_UNAVAILABLE";

export type ReportingFieldError = Readonly<{
  field: string;
  code: string;
  message: string;
}>;

/** Falha tipada das consultas de reporting. */
export type ReportingFailure = Readonly<{
  code: ReportingFailureCode;
  message: string;
  errors?: readonly ReportingFieldError[];
}>;

export const reportingFailure = (
  code: ReportingFailureCode,
  message: string,
  errors?: readonly ReportingFieldError[]
): ReportingFailure => ({code, message, ...(errors?.length ? {errors} : {})});
