import {err, ok, type Result} from "neverthrow";
import {vi} from "vitest";

import {pendingDocumentFixture, type PendingDocumentPageFixture} from "./reporting-fixtures.js";

export type ReportingFailureCode = "INTERNAL_SERVER_ERROR" | "SERVICE_UNAVAILABLE";

export interface ReportingFailureStub {
  code: ReportingFailureCode;
  message: string;
}

type PendingDocumentListResult = Result<PendingDocumentPageFixture, ReportingFailureStub>;

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

function defaultPage(): PendingDocumentPageFixture {
  return {items: [pendingDocumentFixture()], hasNext: false};
}
