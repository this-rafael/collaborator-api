import {err, ok, type Result} from "neverthrow";

import type {PendingDocumentTypeStatisticPosition} from "../models/pending-document-type-statistic.view.js";
import type {
  PendingDocumentTypeStatisticsPage,
  PendingDocumentTypeStatisticsReadModel
} from "../ports/pending-document-type-statistics.read-model.js";
import {reportingFailure, type ReportingFailure} from "../reporting.failure.js";

const objectIdPattern = /^[a-f\d]{24}$/i;

export type ListPendingDocumentTypeStatisticsInput = Readonly<{
  cursor?: string;
  limit?: number;
  after?: PendingDocumentTypeStatisticPosition;
}>;

/** Consulta o ranking agregado de tipos de documento com pendências ativas. */
export class ListPendingDocumentTypeStatisticsQuery {
  constructor(
    private readonly readModel: Pick<
      PendingDocumentTypeStatisticsReadModel,
      "listPendingDocumentTypeStatistics"
    >
  ) {}

  async execute(
    input: ListPendingDocumentTypeStatisticsInput
  ): Promise<Result<PendingDocumentTypeStatisticsPage, ReportingFailure>> {
    const page = validatePage(input);
    if (page.isErr()) return err(page.error);

    return this.readModel.listPendingDocumentTypeStatistics({
      filters: {status: "PENDING", deletedAt: null, unlinkedAt: null},
      order: ["pendingCount:desc", "documentTypeId:asc"],
      limit: page.value,
      ...(input.after ? {after: input.after} : {})
    });
  }
}

function validatePage(
  input: ListPendingDocumentTypeStatisticsInput
): Result<number, ReportingFailure> {
  const errors = [];
  const limit = input.limit ?? 20;

  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    errors.push(fieldError("limit", "INVALID_LIMIT"));
  }
  if (input.cursor?.length === 0) {
    errors.push(fieldError("cursor", "INVALID_CURSOR"));
  }
  if (input.after && !isPosition(input.after)) {
    errors.push(fieldError("cursor", "INVALID_CURSOR"));
  }

  return errors.length > 0 ? err(invalidInput(errors)) : ok(limit);
}

function isPosition(position: PendingDocumentTypeStatisticPosition): boolean {
  return (
    Number.isSafeInteger(position.pendingCount) &&
    position.pendingCount >= 1 &&
    objectIdPattern.test(position.documentTypeId)
  );
}

function invalidInput(errors: readonly {field: string; code: string; message: string}[]) {
  return reportingFailure(
    "INVALID_QUERY_PARAMETER",
    "One or more pending document type statistic query parameters are invalid.",
    errors
  );
}

function fieldError(field: string, code: string) {
  return {field, code, message: `The ${field} query parameter is invalid.`};
}
