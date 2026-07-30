import {Constant, Injectable} from "@tsed/di";

import {
  createDocumentTypesApplication,
  type DocumentTypesApplication
} from "./application/document-types.application.js";
import {CollaboratorDocumentsRuntime} from "../collaborator-documents/collaborator-documents.runtime.js";
import {MongoDocumentTypeRepository} from "./infrastructure/persistence/mongodb/document-type.mongo-repository.js";
import {MongoTransactionManager} from "../../shared/infrastructure/persistence/mongodb/mongo-transaction-manager.js";
import {MongoObjectIdGenerator} from "../../shared/infrastructure/persistence/mongodb/mongo-object-id-generator.js";
import {HmacCursorCodec} from "../../shared/infrastructure/security/hmac-cursor-codec.js";
import {SystemClock} from "../../shared/infrastructure/time/system-clock.js";
import {RateLimitMiddleware} from "../../shared/presentation/http/middlewares/rate-limit.middleware.js";

/** Configuração HTTP do módulo de tipos de documento. */
export type DocumentTypesHttpSettings = Readonly<{
  cursorHmacSecret: string;
  rateLimit: Readonly<{readLimit: number; writeLimit: number; windowMs: number}>;
}>;

const defaultSettings: DocumentTypesHttpSettings = {
  cursorHmacSecret: "test-only-cursor-secret-must-be-at-least-32-bytes",
  rateLimit: {readLimit: 60, writeLimit: 20, windowMs: 60_000}
};

/** Composition root do módulo de tipos de documento. */
@Injectable()
export class DocumentTypesRuntime {
  @Constant<DocumentTypesHttpSettings>("documentTypes", defaultSettings)
  private readonly settings!: DocumentTypesHttpSettings;

  readonly application: DocumentTypesApplication;
  private readonly rateLimiters = new Map<string, RateLimitMiddleware>();
  private cursorCodecInstance?: HmacCursorCodec;

  constructor(
    repository: MongoDocumentTypeRepository,
    documents: CollaboratorDocumentsRuntime,
    transactions: MongoTransactionManager,
    private readonly clock: SystemClock,
    ids: MongoObjectIdGenerator
  ) {
    this.application = createDocumentTypesApplication({
      repository,
      documents: {
        execute: (input, context) => documents.executeByDocumentType(input, context)
      },
      transactions,
      clock: this.clock,
      ids
    });
  }

  get cursorCodec(): HmacCursorCodec {
    this.cursorCodecInstance ??= new HmacCursorCodec(this.settings.cursorHmacSecret, this.clock);
    return this.cursorCodecInstance;
  }

  rateLimiter(operationId: string, kind: "read" | "write"): RateLimitMiddleware {
    const existing = this.rateLimiters.get(operationId);
    if (existing) return existing;

    const limiter = new RateLimitMiddleware({
      limit:
        kind === "read" ? this.settings.rateLimit.readLimit : this.settings.rateLimit.writeLimit,
      windowMs: this.settings.rateLimit.windowMs,
      operationId,
      clock: this.clock
    });
    this.rateLimiters.set(operationId, limiter);
    return limiter;
  }
}
