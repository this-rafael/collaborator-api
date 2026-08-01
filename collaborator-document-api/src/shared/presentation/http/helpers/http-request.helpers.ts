import type {Response} from "express";

import type {FieldError} from "../schemas/problem-details.js";

export const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

export function isJsonRequest(res: Response): boolean {
  return Boolean(res.req?.is("application/json"));
}

export function isObjectId(value: string): boolean {
  return OBJECT_ID_PATTERN.test(value);
}

export function queryValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function fieldError(field: string, code: string, message: string): FieldError {
  return {field, code, message};
}

export type SimpleHttpFailure = Readonly<{
  code: string;
  errors?: readonly FieldError[];
}>;

export function invalidObjectIdFailure(): SimpleHttpFailure {
  return {
    code: "INVALID_OBJECT_ID",
    errors: [
      fieldError("id", "INVALID_OBJECT_ID", "Informe um ObjectId hexadecimal com 24 caracteres.")
    ]
  };
}

export function invalidQueryFailure(field: string): SimpleHttpFailure {
  return {
    code: "INVALID_QUERY_PARAMETER",
    errors: [
      fieldError(field, "INVALID_QUERY_PARAMETER", "Informe um parâmetro de consulta válido.")
    ]
  };
}

export function validationFailure(field: string): SimpleHttpFailure {
  return {
    code: "VALIDATION_ERROR",
    errors: [fieldError(field, "VALIDATION_ERROR", "Os dados informados são inválidos.")]
  };
}

/** Valida limit/cursor de listagens keyset (1–100, cursor não-vazio quando presente). */
export function parseKeysetPaging(
  rawLimit: string | undefined,
  rawCursor: string | undefined
): {ok: true; limit: number; cursor: string | undefined} | {ok: false; field: "limit" | "cursor"} {
  const limit = rawLimit === undefined || rawLimit === "" ? 20 : Number(rawLimit);
  const cursor = rawCursor === undefined ? undefined : queryValue(rawCursor);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return {ok: false, field: "limit"};
  }
  if (rawCursor !== undefined && !cursor) {
    return {ok: false, field: "cursor"};
  }
  return {ok: true, limit, cursor};
}
