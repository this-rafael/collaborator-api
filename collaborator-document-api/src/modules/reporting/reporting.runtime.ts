import {Constant, Injectable} from "@tsed/di";

import {HmacCursorCodec} from "../../shared/infrastructure/security/hmac-cursor-codec.js";
import {SystemClock} from "../../shared/infrastructure/time/system-clock.js";
import {RateLimitMiddleware} from "../../shared/presentation/http/middlewares/rate-limit.middleware.js";
import {GetCompletenessStatisticsQuery} from "./application/queries/get-completeness-statistics.query.js";
import {ListPendingDocumentTypeStatisticsQuery} from "./application/queries/list-pending-document-type-statistics.query.js";
import {ListPendingDocumentsQuery} from "./application/queries/list-pending-documents.query.js";
import {MongoReportingRepository} from "./infrastructure/persistence/mongodb/mongo-reporting.repository.js";

export type ReportingHttpSettings = Readonly<{
  cursorHmacSecret: string;
  rateLimit: Readonly<{readLimit: number; writeLimit: number; windowMs: number}>;
}>;

const defaultSettings: ReportingHttpSettings = {
  cursorHmacSecret: "test-only-cursor-secret-must-be-at-least-32-bytes",
  rateLimit: {readLimit: 60, writeLimit: 20, windowMs: 60_000}
};

/** Superfície de composição das consultas e serviços HTTP de reporting. */
@Injectable()
export class ReportingRuntime {
  @Constant<ReportingHttpSettings>("reporting", defaultSettings)
  private readonly settings!: ReportingHttpSettings;

  readonly listPendingDocuments: ListPendingDocumentsQuery;
  readonly listPendingDocumentTypeStatistics: ListPendingDocumentTypeStatisticsQuery;
  readonly getCompletenessStatistics: GetCompletenessStatisticsQuery;
  private readonly rateLimiters = new Map<string, RateLimitMiddleware>();
  private cursorCodecInstance?: HmacCursorCodec;

  constructor(
    repository: MongoReportingRepository,
    private readonly clock: SystemClock
  ) {
    this.listPendingDocuments = new ListPendingDocumentsQuery(repository);
    this.listPendingDocumentTypeStatistics = new ListPendingDocumentTypeStatisticsQuery(repository);
    this.getCompletenessStatistics = new GetCompletenessStatisticsQuery(repository, clock);
  }

  get cursorCodec(): HmacCursorCodec {
    this.cursorCodecInstance ??= new HmacCursorCodec(this.settings.cursorHmacSecret, this.clock);
    return this.cursorCodecInstance;
  }

  rateLimiter(operationId: string): RateLimitMiddleware {
    const existing = this.rateLimiters.get(operationId);
    if (existing) return existing;
    const limiter = new RateLimitMiddleware({
      limit: this.settings.rateLimit.readLimit,
      windowMs: this.settings.rateLimit.windowMs,
      operationId,
      clock: this.clock
    });
    this.rateLimiters.set(operationId, limiter);
    return limiter;
  }

  resetRateLimiters(): void {
    for (const limiter of this.rateLimiters.values()) limiter.reset();
  }
}
