import {err, ok, type Result} from "neverthrow";

import type {LatestSubmissionPosition} from "../models/latest-submission.view.js";
import type {
  LatestSubmissionPage,
  LatestSubmissionsReadModel
} from "../ports/latest-submissions.read-model.js";
import {reportingFailure, type ReportingFailure} from "../reporting.failure.js";

const objectIdPattern = /^[a-f\d]{24}$/i;

export type ListLatestSubmissionsInput = Readonly<{
  cursor?: string;
  limit?: number;
  after?: LatestSubmissionPosition;
}>;

/** Consulta a projeção corrente do último envio de cada vínculo ativo. */
export class ListLatestSubmissionsQuery {
  constructor(
    private readonly readModel: Pick<LatestSubmissionsReadModel, "listLatestSubmissions">
  ) {}

  async execute(
    input: ListLatestSubmissionsInput
  ): Promise<Result<LatestSubmissionPage, ReportingFailure>> {
    const validation = validatePage(input);
    if (validation.isErr()) return err(validation.error);

    return this.readModel.listLatestSubmissions({
      filters: {status: "SUBMITTED", deletedAt: null, unlinkedAt: null},
      order: ["lastSubmittedAt:desc", "_id:desc"],
      limit: validation.value,
      ...(input.after ? {after: input.after} : {})
    });
  }
}

function validatePage(input: ListLatestSubmissionsInput): Result<number, ReportingFailure> {
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

function isPosition(position: LatestSubmissionPosition): boolean {
  const parsed = new Date(position.lastSubmittedAt);
  return (
    objectIdPattern.test(position.id) &&
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString() === position.lastSubmittedAt
  );
}

function invalidInput(errors: readonly {field: string; code: string; message: string}[]) {
  return reportingFailure(
    "INVALID_QUERY_PARAMETER",
    "One or more latest submission query parameters are invalid.",
    errors
  );
}

function fieldError(field: "cursor" | "limit", code: string) {
  return {field, code, message: `The ${field} query parameter is invalid.`};
}
