import type {Result} from "neverthrow";

import type {CompletenessCounts} from "../models/completeness-statistics.view.js";
import type {ReportingFailure} from "../reporting.failure.js";

export type ActiveDocumentFilters = Readonly<{
  deletedAt: null;
  unlinkedAt: null;
}>;

/** Porta do read model das contagens de completude. */
export interface CompletenessStatisticsReadModel {
  getCounts(filters: ActiveDocumentFilters): Promise<Result<CompletenessCounts, ReportingFailure>>;
}
