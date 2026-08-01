import type {Result} from "neverthrow";

import type {
  SubmissionEventPosition,
  SubmissionEventView
} from "../models/submission-event.view.js";
import type {ReportingFailure} from "../reporting.failure.js";

export type SubmissionEventFilters = Readonly<{
  deletedAt: null;
  unlinkedAt: null;
  hasVersions: true;
}>;

export type SubmissionEventPage = Readonly<{
  items: readonly SubmissionEventView[];
  hasNext: boolean;
}>;

/** Porta do read model do histórico de envios. */
export interface SubmissionEventsReadModel {
  listSubmissionEvents(input: {
    filters: SubmissionEventFilters;
    order: readonly ["submittedAt:desc", "documentId:desc", "version:desc"];
    limit: number;
    after?: SubmissionEventPosition;
  }): Promise<Result<SubmissionEventPage, ReportingFailure>>;
}
