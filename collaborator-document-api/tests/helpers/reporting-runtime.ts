import {err, ok, type Result} from "neverthrow";
import {vi} from "vitest";

import {
  completenessCountsFixture,
  latestSubmissionFixture,
  pendingDocumentFixture,
  pendingDocumentTypeStatisticFixture,
  submissionEventFixture,
  type CompletenessCountsFixture,
  type LatestSubmissionPageFixture,
  type PendingDocumentPageFixture,
  type PendingDocumentTypeStatisticsPageFixture,
  type SubmissionEventPageFixture
} from "./reporting-fixtures.js";

export type ReportingFailureCode = "INTERNAL_SERVER_ERROR" | "SERVICE_UNAVAILABLE";

export interface ReportingFailureStub {
  code: ReportingFailureCode;
  message: string;
}

type PendingDocumentListResult = Result<PendingDocumentPageFixture, ReportingFailureStub>;
type CompletenessCountsResult = Result<CompletenessCountsFixture, ReportingFailureStub>;
type PendingDocumentTypeStatisticsResult = Result<
  PendingDocumentTypeStatisticsPageFixture,
  ReportingFailureStub
>;
type LatestSubmissionsResult = Result<LatestSubmissionPageFixture, ReportingFailureStub>;
type SubmissionEventsResult = Result<SubmissionEventPageFixture, ReportingFailureStub>;

export class PendingDocumentsRepositoryStub {
  readonly list = vi.fn();

  constructor(result: PendingDocumentListResult = ok(defaultPage())) {
    this.list.mockResolvedValue(result);
  }

  static success(page: PendingDocumentPageFixture = defaultPage()): PendingDocumentsRepositoryStub {
    return new PendingDocumentsRepositoryStub(ok(page));
  }

  static empty(): PendingDocumentsRepositoryStub {
    return PendingDocumentsRepositoryStub.success({items: [], hasNext: false});
  }

  static internalError(): PendingDocumentsRepositoryStub {
    return PendingDocumentsRepositoryStub.failure(
      "INTERNAL_SERVER_ERROR",
      "database internals must not leak"
    );
  }

  static unavailable(): PendingDocumentsRepositoryStub {
    return PendingDocumentsRepositoryStub.failure(
      "SERVICE_UNAVAILABLE",
      "reporting dependency unavailable"
    );
  }

  private static failure(
    code: ReportingFailureCode,
    message: string
  ): PendingDocumentsRepositoryStub {
    return new PendingDocumentsRepositoryStub(err({code, message}));
  }
}

export class CompletenessStatisticsRepositoryStub {
  readonly getCounts = vi.fn();

  constructor(result: CompletenessCountsResult = ok(completenessCountsFixture())) {
    this.getCounts.mockResolvedValue(result);
  }

  static success(
    counts: CompletenessCountsFixture = completenessCountsFixture()
  ): CompletenessStatisticsRepositoryStub {
    return new CompletenessStatisticsRepositoryStub(ok(counts));
  }

  static internalError(): CompletenessStatisticsRepositoryStub {
    return CompletenessStatisticsRepositoryStub.failure(
      "INTERNAL_SERVER_ERROR",
      "database internals must not leak"
    );
  }

  static unavailable(): CompletenessStatisticsRepositoryStub {
    return CompletenessStatisticsRepositoryStub.failure(
      "SERVICE_UNAVAILABLE",
      "reporting dependency unavailable"
    );
  }

  private static failure(
    code: ReportingFailureCode,
    message: string
  ): CompletenessStatisticsRepositoryStub {
    return new CompletenessStatisticsRepositoryStub(err({code, message}));
  }
}

export class PendingDocumentTypeStatisticsRepositoryStub {
  readonly listPendingDocumentTypeStatistics = vi.fn();

  constructor(result: PendingDocumentTypeStatisticsResult = ok(defaultStatisticsPage())) {
    this.listPendingDocumentTypeStatistics.mockResolvedValue(result);
  }

  static success(
    page: PendingDocumentTypeStatisticsPageFixture = defaultStatisticsPage()
  ): PendingDocumentTypeStatisticsRepositoryStub {
    return new PendingDocumentTypeStatisticsRepositoryStub(ok(page));
  }

  static empty(): PendingDocumentTypeStatisticsRepositoryStub {
    return PendingDocumentTypeStatisticsRepositoryStub.success({items: [], hasNext: false});
  }

  static internalError(): PendingDocumentTypeStatisticsRepositoryStub {
    return PendingDocumentTypeStatisticsRepositoryStub.failure(
      "INTERNAL_SERVER_ERROR",
      "database internals must not leak"
    );
  }

  static unavailable(): PendingDocumentTypeStatisticsRepositoryStub {
    return PendingDocumentTypeStatisticsRepositoryStub.failure(
      "SERVICE_UNAVAILABLE",
      "reporting dependency unavailable"
    );
  }

  private static failure(
    code: ReportingFailureCode,
    message: string
  ): PendingDocumentTypeStatisticsRepositoryStub {
    return new PendingDocumentTypeStatisticsRepositoryStub(err({code, message}));
  }
}

export class LatestSubmissionsRepositoryStub {
  readonly listLatestSubmissions = vi.fn();

  constructor(result: LatestSubmissionsResult = ok(defaultLatestSubmissionsPage())) {
    this.listLatestSubmissions.mockResolvedValue(result);
  }

  static success(
    page: LatestSubmissionPageFixture = defaultLatestSubmissionsPage()
  ): LatestSubmissionsRepositoryStub {
    return new LatestSubmissionsRepositoryStub(ok(page));
  }

  static empty(): LatestSubmissionsRepositoryStub {
    return LatestSubmissionsRepositoryStub.success({items: [], hasNext: false});
  }

  static internalError(): LatestSubmissionsRepositoryStub {
    return LatestSubmissionsRepositoryStub.failure(
      "INTERNAL_SERVER_ERROR",
      "database internals must not leak"
    );
  }

  static unavailable(): LatestSubmissionsRepositoryStub {
    return LatestSubmissionsRepositoryStub.failure(
      "SERVICE_UNAVAILABLE",
      "reporting dependency unavailable"
    );
  }

  private static failure(
    code: ReportingFailureCode,
    message: string
  ): LatestSubmissionsRepositoryStub {
    return new LatestSubmissionsRepositoryStub(err({code, message}));
  }
}

export class SubmissionEventsRepositoryStub {
  readonly listSubmissionEvents = vi.fn();

  constructor(result: SubmissionEventsResult = ok(defaultSubmissionEventsPage())) {
    this.listSubmissionEvents.mockResolvedValue(result);
  }

  static success(
    page: SubmissionEventPageFixture = defaultSubmissionEventsPage()
  ): SubmissionEventsRepositoryStub {
    return new SubmissionEventsRepositoryStub(ok(page));
  }

  static empty(): SubmissionEventsRepositoryStub {
    return SubmissionEventsRepositoryStub.success({items: [], hasNext: false});
  }

  static internalError(): SubmissionEventsRepositoryStub {
    return SubmissionEventsRepositoryStub.failure(
      "INTERNAL_SERVER_ERROR",
      "database internals must not leak"
    );
  }

  static unavailable(): SubmissionEventsRepositoryStub {
    return SubmissionEventsRepositoryStub.failure(
      "SERVICE_UNAVAILABLE",
      "reporting dependency unavailable"
    );
  }

  private static failure(
    code: ReportingFailureCode,
    message: string
  ): SubmissionEventsRepositoryStub {
    return new SubmissionEventsRepositoryStub(err({code, message}));
  }
}

function defaultPage(): PendingDocumentPageFixture {
  return {items: [pendingDocumentFixture()], hasNext: false};
}

function defaultStatisticsPage(): PendingDocumentTypeStatisticsPageFixture {
  return {items: [pendingDocumentTypeStatisticFixture()], hasNext: false};
}

function defaultLatestSubmissionsPage(): LatestSubmissionPageFixture {
  return {items: [latestSubmissionFixture()], hasNext: false};
}

function defaultSubmissionEventsPage(): SubmissionEventPageFixture {
  return {items: [submissionEventFixture()], hasNext: false};
}
