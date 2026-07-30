import {Constant, Injectable} from "@tsed/di";

import {
  createCollaboratorsApplication,
  type CollaboratorsApplication
} from "./application/collaborators.application.js";
import {CollaboratorDocumentsRuntime} from "../collaborator-documents/collaborator-documents.runtime.js";
import {MongoCollaboratorRepository} from "./infrastructure/persistence/mongodb/collaborator.mongo-repository.js";
import {MongoTransactionManager} from "../../shared/infrastructure/persistence/mongodb/mongo-transaction-manager.js";
import {MongoObjectIdGenerator} from "../../shared/infrastructure/persistence/mongodb/mongo-object-id-generator.js";
import {HmacCursorCodec} from "../../shared/infrastructure/security/hmac-cursor-codec.js";
import {SystemClock} from "../../shared/infrastructure/time/system-clock.js";
import {RateLimitMiddleware} from "../../shared/presentation/http/middlewares/rate-limit.middleware.js";

export type CollaboratorsHttpSettings = Readonly<{
  cursorHmacSecret: string;
  rateLimit: Readonly<{readLimit: number; writeLimit: number; windowMs: number}>;
}>;

const defaultSettings: CollaboratorsHttpSettings = {
  cursorHmacSecret: "test-only-cursor-secret-must-be-at-least-32-bytes",
  rateLimit: {readLimit: 60, writeLimit: 20, windowMs: 60_000}
};

/**
 * Composition root do módulo de colaboradores.
 *
 * Mantém dependências técnicas fora do controlador e compõe apenas portas e
 * casos de uso framework-neutral. A configuração validada é fornecida pelo
 * bootstrap sob a chave `collaborators`.
 */
@Injectable()
export class CollaboratorsRuntime {
  @Constant<CollaboratorsHttpSettings>("collaborators", defaultSettings)
  private readonly settings!: CollaboratorsHttpSettings;

  readonly application: CollaboratorsApplication;
  private readonly rateLimiters = new Map<string, RateLimitMiddleware>();
  private cursorCodecInstance?: HmacCursorCodec;

  constructor(
    repository: MongoCollaboratorRepository,
    documents: CollaboratorDocumentsRuntime,
    transactions: MongoTransactionManager,
    private readonly clock: SystemClock,
    ids: MongoObjectIdGenerator
  ) {
    this.application = createCollaboratorsApplication({
      repository,
      documents,
      transactions,
      clock,
      ids
    });
  }

  get cursorCodec(): HmacCursorCodec {
    if (!this.cursorCodecInstance) {
      this.cursorCodecInstance = new HmacCursorCodec(this.settings.cursorHmacSecret, this.clock);
    }
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
