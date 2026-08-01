import {err, ok, type Result} from "neverthrow";

import type {SubmissionEventPosition} from "../models/submission-event.view.js";
import type {
  SubmissionEventPage,
  SubmissionEventsReadModel
} from "../ports/submission-events.read-model.js";
import {reportingFailure, type ReportingFailure} from "../reporting.failure.js";

const objectIdPattern = /^[a-f\d]{24}$/i;

export type ListSubmissionEventsInput = Readonly<{
  cursor?: string;
  limit?: number;
  after?: SubmissionEventPosition;
}>;

/** Consulta cada versão persistida nos históricos documentais ativos. */
export class ListSubmissionEventsQuery {
  constructor(
    private readonly readModel: Pick<SubmissionEventsReadModel, "listSubmissionEvents">
  ) {}

  async execute(
    input: ListSubmissionEventsInput
  ): Promise<Result<SubmissionEventPage, ReportingFailure>> {
    const validation = validatePage(input);
    if (validation.isErr()) return err(validation.error);

    return this.readModel.listSubmissionEvents({
      filters: {deletedAt: null, unlinkedAt: null, hasVersions: true},
      order: ["submittedAt:desc", "documentId:desc", "version:desc"],
      limit: validation.value,
      ...(input.after ? {after: input.after} : {})
    });
  }
}

function validatePage(input: ListSubmissionEventsInput): Result<number, ReportingFailure> {
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

function isPosition(position: SubmissionEventPosition): boolean {
  const parsed = new Date(position.submittedAt);
  return (
    objectIdPattern.test(position.documentId) &&
    Number.isSafeInteger(position.version) &&
    position.version >= 1 &&
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString() === position.submittedAt
  );
}

function invalidInput(errors: readonly {field: string; code: string; message: string}[]) {
  return reportingFailure(
    "INVALID_QUERY_PARAMETER",
    "One or more submission event query parameters are invalid.",
    errors
  );
}

function fieldError(field: "cursor" | "limit", code: string) {
  return {field, code, message: `The ${field} query parameter is invalid.`};
}
