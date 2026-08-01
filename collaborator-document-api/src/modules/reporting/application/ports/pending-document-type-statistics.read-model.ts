import type {Result} from "neverthrow";

import type {
  PendingDocumentTypeStatisticPosition,
  PendingDocumentTypeStatisticView
} from "../models/pending-document-type-statistic.view.js";
import type {ReportingFailure} from "../reporting.failure.js";

export type PendingDocumentTypeStatisticFilters = Readonly<{
  status: "PENDING";
  deletedAt: null;
  unlinkedAt: null;
}>;

export type PendingDocumentTypeStatisticsPage = Readonly<{
  items: readonly PendingDocumentTypeStatisticView[];
  hasNext: boolean;
}>;

/** Porta do read model do ranking de tipos de documento com pendências. */
export interface PendingDocumentTypeStatisticsReadModel {
  listPendingDocumentTypeStatistics(input: {
    filters: PendingDocumentTypeStatisticFilters;
    order: readonly ["pendingCount:desc", "documentTypeId:asc"];
    limit: number;
    after?: PendingDocumentTypeStatisticPosition;
  }): Promise<Result<PendingDocumentTypeStatisticsPage, ReportingFailure>>;
}
