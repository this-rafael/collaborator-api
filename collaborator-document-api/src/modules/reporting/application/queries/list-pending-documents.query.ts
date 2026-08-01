import {err, ok, type Result} from "neverthrow";

import type {PendingDocumentPosition} from "../models/pending-document.view.js";
import type {
  PendingDocumentFilters,
  PendingDocumentPage,
  PendingDocumentsReadModel
} from "../ports/pending-documents.read-model.js";
import {reportingFailure, type ReportingFailure} from "../reporting.failure.js";

const cpfPattern = /^\d{11}$/;
const documentTypeCodePattern = /^[A-Z][A-Z0-9_]{1,63}$/;
const objectIdPattern = /^[a-f\d]{24}$/i;

export type ListPendingDocumentsInput = Readonly<{
  collaboratorName?: string;
  cpf?: string;
  documentTypeName?: string;
  documentTypeCode?: string;
  cursor?: string;
  limit?: number;
  after?: PendingDocumentPosition;
}>;

/** Normaliza os filtros públicos usados pela consulta e pelo contexto do cursor. */
export const normalizePendingDocumentFilters = (
  input: ListPendingDocumentsInput
): Result<PendingDocumentFilters, ReportingFailure> => {
  const errors = [];
  const filters: {
    status: "PENDING";
    deletedAt: null;
    unlinkedAt: null;
    collaboratorName?: string;
    cpf?: string;
    documentTypeName?: string;
    documentTypeCode?: string;
  } = {status: "PENDING", deletedAt: null, unlinkedAt: null};

  if (input.collaboratorName !== undefined) {
    const name = normalizeSearchText(input.collaboratorName);
    if (name) filters.collaboratorName = name;
  }
  if (input.documentTypeName !== undefined) {
    const name = normalizeSearchText(input.documentTypeName);
    if (name) filters.documentTypeName = name;
  }
  if (input.cpf !== undefined) {
    if (!cpfPattern.test(input.cpf)) errors.push(fieldError("cpf", "INVALID_CPF"));
    else filters.cpf = input.cpf;
  }
  if (input.documentTypeCode !== undefined) {
    if (!documentTypeCodePattern.test(input.documentTypeCode)) {
      errors.push(fieldError("documentTypeCode", "INVALID_DOCUMENT_TYPE_CODE"));
    } else filters.documentTypeCode = input.documentTypeCode;
  }

  if (errors.length > 0) return err(invalidInput(errors));
  return ok(Object.freeze(filters));
};

/** Consulta a projeção corrente de vínculos pendentes. */
export class ListPendingDocumentsQuery {
  constructor(private readonly readModel: Pick<PendingDocumentsReadModel, "list">) {}

  async execute(
    input: ListPendingDocumentsInput
  ): Promise<Result<PendingDocumentPage, ReportingFailure>> {
    const validation = validatePage(input);
    if (validation.isErr()) return err(validation.error);

    const filters = normalizePendingDocumentFilters(input);
    if (filters.isErr()) return err(filters.error);

    return this.readModel.list({
      filters: filters.value,
      order: ["documentTypeId:asc", "collaboratorId:asc", "_id:asc"],
      limit: validation.value,
      ...(input.after ? {after: input.after} : {})
    });
  }
}

function validatePage(input: ListPendingDocumentsInput): Result<number, ReportingFailure> {
  const errors = [];
  const limit = input.limit ?? 20;

  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    errors.push(fieldError("limit", "INVALID_LIMIT"));
  }
  if (input.cursor !== undefined && input.cursor.length === 0) {
    errors.push(fieldError("cursor", "INVALID_CURSOR"));
  }
  if (input.after && !isPosition(input.after)) {
    errors.push(fieldError("cursor", "INVALID_CURSOR"));
  }

  return errors.length > 0 ? err(invalidInput(errors)) : ok(limit);
}

function normalizeSearchText(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

function isPosition(position: PendingDocumentPosition): boolean {
  return (
    objectIdPattern.test(position.documentTypeId) &&
    objectIdPattern.test(position.collaboratorId) &&
    objectIdPattern.test(position.id)
  );
}

function invalidInput(errors: readonly {field: string; code: string; message: string}[]) {
  return reportingFailure(
    "INVALID_QUERY_PARAMETER",
    "One or more pending document query parameters are invalid.",
    errors
  );
}

function fieldError(field: string, code: string) {
  return {field, code, message: `The ${field} query parameter is invalid.`};
}
