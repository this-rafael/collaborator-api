import type {Result} from "neverthrow";

import type {
  LatestSubmissionPosition,
  LatestSubmissionView
} from "../models/latest-submission.view.js";
import type {ReportingFailure} from "../reporting.failure.js";

export type LatestSubmissionFilters = Readonly<{
  status: "SUBMITTED";
  deletedAt: null;
  unlinkedAt: null;
}>;

export type LatestSubmissionPage = Readonly<{
  items: readonly LatestSubmissionView[];
  hasNext: boolean;
}>;

/** Porta do read model dos últimos envios. */
export interface LatestSubmissionsReadModel {
  listLatestSubmissions(input: {
    filters: LatestSubmissionFilters;
    order: readonly ["lastSubmittedAt:desc", "_id:desc"];
    limit: number;
    after?: LatestSubmissionPosition;
  }): Promise<Result<LatestSubmissionPage, ReportingFailure>>;
}
