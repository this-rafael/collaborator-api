import {Constant, Injectable} from "@tsed/di";

import {
  createCollaboratorDocumentsApplication,
  type CollaboratorDocumentsApplication
} from "./application/collaborator-documents.application.js";
import type {
  CollaboratorDocumentsFailure,
  SoftDeleteCollaboratorDocumentsInput
} from "./application/contracts/soft-delete-collaborator-documents.input.js";
import {collaboratorDocumentsFailure} from "./application/contracts/soft-delete-collaborator-documents.input.js";
import {
  CollaboratorStatusReaderAdapter,
  DocumentTypeStatusReaderAdapter
} from "./infrastructure/adapters/parent-status.readers.js";
import {MongoCollaboratorDocumentRepository} from "./infrastructure/persistence/mongodb/collaborator-document.mongo-repository.js";
import {MongoObjectIdGenerator} from "../../shared/infrastructure/persistence/mongodb/mongo-object-id-generator.js";
import {MongoTransactionManager} from "../../shared/infrastructure/persistence/mongodb/mongo-transaction-manager.js";
import {HmacCursorCodec} from "../../shared/infrastructure/security/hmac-cursor-codec.js";
import {SystemClock} from "../../shared/infrastructure/time/system-clock.js";
import type {TransactionContext} from "../../shared/application/ports/transaction-manager.js";
import {RateLimitMiddleware} from "../../shared/presentation/http/middlewares/rate-limit.middleware.js";
import {err, type Result} from "neverthrow";

/** Configuração HTTP do módulo de vínculos documentais. */
export type CollaboratorDocumentsHttpSettings = Readonly<{
  cursorHmacSecret: string;
  rateLimit: Readonly<{readLimit: number; writeLimit: number; windowMs: number}>;
}>;

const defaultSettings: CollaboratorDocumentsHttpSettings = {
  cursorHmacSecret: "test-only-cursor-secret-must-be-at-least-32-bytes",
  rateLimit: {readLimit: 60, writeLimit: 20, windowMs: 60_000}
};

/**
 * Superfície pública do módulo collaborator-documents para composições entre
 * módulos e composition root HTTP.
 */
@Injectable()
export class CollaboratorDocumentsRuntime {
  @Constant<CollaboratorDocumentsHttpSettings>("collaboratorDocuments", defaultSettings)
  private readonly settings!: CollaboratorDocumentsHttpSettings;

  readonly application: CollaboratorDocumentsApplication;
  private readonly rateLimiters = new Map<string, RateLimitMiddleware>();
  private cursorCodecInstance?: HmacCursorCodec;

  constructor(
    private readonly repository: MongoCollaboratorDocumentRepository,
    collaborators: CollaboratorStatusReaderAdapter,
    documentTypes: DocumentTypeStatusReaderAdapter,
    transactions: MongoTransactionManager,
    private readonly clock: SystemClock,
    ids: MongoObjectIdGenerator
  ) {
    this.application = createCollaboratorDocumentsApplication({
      repository,
      collaborators,
      documentTypes,
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

  /** Limpa contadores em memória — usado pelos testes HTTP entre casos. */
  resetRateLimiters(): void {
    for (const limiter of this.rateLimiters.values()) limiter.reset();
  }

  async execute(
    input: SoftDeleteCollaboratorDocumentsInput,
    context: TransactionContext
  ): Promise<Result<void, CollaboratorDocumentsFailure>> {
    return this.application.softDelete.execute(input, context);
  }

  async executeByDocumentType(
    input: Readonly<{documentTypeId: string; deletedAt: string}>,
    context: TransactionContext
  ): Promise<Result<void, CollaboratorDocumentsFailure>> {
    if (!input || typeof input.documentTypeId !== "string" || typeof input.deletedAt !== "string") {
      return err(
        collaboratorDocumentsFailure(
          "INTERNAL_SERVER_ERROR",
          "Invalid collaborator document cascade input."
        )
      );
    }
    const deletedAt = new Date(input.deletedAt);
    if (!input.documentTypeId || Number.isNaN(deletedAt.getTime())) {
      return err(
        collaboratorDocumentsFailure(
          "INTERNAL_SERVER_ERROR",
          "Invalid collaborator document cascade input."
        )
      );
    }
    return this.repository.softDeleteActiveByDocumentTypeId(
      input.documentTypeId,
      deletedAt,
      context
    );
  }
}
