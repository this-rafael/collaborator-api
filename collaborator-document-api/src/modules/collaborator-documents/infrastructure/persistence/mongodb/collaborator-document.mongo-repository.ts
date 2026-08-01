import {Injectable} from "@tsed/di";
import {$log} from "@tsed/logger";
import {MongooseService} from "@tsed/mongoose";
import {BSON, type Document} from "mongodb";
import {err, ok, type Result} from "neverthrow";
import {Types, type Connection} from "mongoose";

import type {TransactionContext} from "../../../../../shared/application/ports/transaction-manager.js";
import {getMongoSession} from "../../../../../shared/infrastructure/persistence/mongodb/mongo-transaction-context.js";
import {
  collaboratorDocumentsFailure,
  type CollaboratorDocumentsFailure
} from "../../../application/contracts/soft-delete-collaborator-documents.input.js";
import type {CollaboratorDocumentOutput} from "../../../application/contracts/collaborator-document-output.js";
import type {
  DocumentVersionMetadata,
  DocumentVersionOutput
} from "../../../application/contracts/document-version-output.js";
import type {
  CollaboratorDocumentListFilters,
  CollaboratorDocumentListPage,
  CollaboratorDocumentRepository
} from "../../../application/ports/collaborator-document-repository.port.js";
import type {CollaboratorDocument} from "../../../domain/aggregates/collaborator-document.js";
import {
  collaboratorDocumentApplicationFailure,
  type CollaboratorDocumentFailure
} from "../../../domain/errors/collaborator-document.failure.js";
import {getCollaboratorDocumentMongoModel} from "./collaborator-document.mongo-document.js";
import {
  collaboratorDocumentOutputFromMongoDocument,
  collaboratorDocumentToMongoDocument,
  type CollaboratorDocumentMongoRead
} from "./collaborator-document.mongo-mapper.js";

const unavailable = (): CollaboratorDocumentFailure =>
  collaboratorDocumentApplicationFailure(
    "SERVICE_UNAVAILABLE",
    "Collaborator document persistence is unavailable."
  );

const embeddedHistoryWarningBytes = 8 * 1024 * 1024;

/** Persistência Mongo pertencente ao módulo collaborator-documents. */
@Injectable()
export class MongoCollaboratorDocumentRepository implements CollaboratorDocumentRepository {
  constructor(private readonly mongoose: MongooseService) {}

  appendVersion(input: {
    id: string;
    metadata: DocumentVersionMetadata;
    submittedAt: Date;
  }): Promise<Result<DocumentVersionOutput, CollaboratorDocumentFailure>> {
    return this.appendVersionSafely(input);
  }

  softDeleteActiveByCollaboratorId(
    collaboratorId: string,
    deletedAt: Date,
    context: TransactionContext
  ): Promise<Result<void, CollaboratorDocumentsFailure>> {
    return this.softDeleteByFieldSafely("collaboratorId", collaboratorId, deletedAt, context);
  }

  softDeleteActiveByDocumentTypeId(
    documentTypeId: string,
    deletedAt: Date,
    context: TransactionContext
  ): Promise<Result<void, CollaboratorDocumentsFailure>> {
    return this.softDeleteByFieldSafely("documentTypeId", documentTypeId, deletedAt, context);
  }

  create(
    document: CollaboratorDocument
  ): Promise<Result<CollaboratorDocumentOutput, CollaboratorDocumentFailure>> {
    return this.createSafely(document);
  }

  findById(id: string): Promise<Result<CollaboratorDocumentOutput, CollaboratorDocumentFailure>> {
    return this.findByIdSafely(id);
  }

  list(input: {
    filters: CollaboratorDocumentListFilters;
    afterId?: string;
    limit: number;
  }): Promise<Result<CollaboratorDocumentListPage, CollaboratorDocumentFailure>> {
    return this.listSafely(input);
  }

  unlinkActive(
    id: string,
    unlinkedAt: Date,
    updatedAt: Date
  ): Promise<Result<void, CollaboratorDocumentFailure>> {
    return this.unlinkActiveSafely(id, unlinkedAt, updatedAt);
  }

  private connection(): Connection | undefined {
    const connection = this.mongoose.get();
    return connection?.readyState === 1 ? connection : undefined;
  }

  private model() {
    const connection = this.connection();
    return connection ? getCollaboratorDocumentMongoModel(connection) : undefined;
  }

  private async softDeleteByFieldSafely(
    field: "collaboratorId" | "documentTypeId",
    value: string,
    deletedAt: Date,
    context: TransactionContext
  ): Promise<Result<void, CollaboratorDocumentsFailure>> {
    const session = getMongoSession(context);
    if (!session) {
      return err(
        collaboratorDocumentsFailure(
          "SERVICE_UNAVAILABLE",
          "Collaborator document persistence is unavailable."
        )
      );
    }

    try {
      const database = this.mongoose.get()?.db;
      if (!database) {
        return err(
          collaboratorDocumentsFailure(
            "SERVICE_UNAVAILABLE",
            "Collaborator document persistence is unavailable."
          )
        );
      }
      await database
        .collection("collaborator_documents")
        .updateMany({[field]: value, deletedAt: null}, {$set: {deletedAt}}, {session});
      return ok(undefined);
    } catch {
      return err(
        collaboratorDocumentsFailure(
          "INTERNAL_SERVER_ERROR",
          "Collaborator document cascade failed."
        )
      );
    }
  }

  private async createSafely(
    document: CollaboratorDocument
  ): Promise<Result<CollaboratorDocumentOutput, CollaboratorDocumentFailure>> {
    try {
      const model = this.model();
      const mongoDocument = collaboratorDocumentToMongoDocument(document);
      if (!model) return err(unavailable());
      if (mongoDocument.isErr()) return err(mongoDocument.error);

      const created = await model.create(mongoDocument.value);
      return collaboratorDocumentOutputFromMongoDocument(
        created.toObject() as CollaboratorDocumentMongoRead
      );
    } catch (error) {
      return err(mapMongoFailure(error));
    }
  }

  private async appendVersionSafely(input: {
    id: string;
    metadata: DocumentVersionMetadata;
    submittedAt: Date;
  }): Promise<Result<DocumentVersionOutput, CollaboratorDocumentFailure>> {
    try {
      const model = this.model();
      if (!model) return err(unavailable());
      if (!Types.ObjectId.isValid(input.id)) {
        return err(
          collaboratorDocumentApplicationFailure(
            "COLLABORATOR_DOCUMENT_NOT_FOUND",
            "Collaborator document was not found."
          )
        );
      }

      const nextVersion = {$add: [{$ifNull: ["$currentVersion", 0]}, 1]};
      const updated = await model
        .findOneAndUpdate(
          {_id: input.id, deletedAt: null, unlinkedAt: null},
          [
            {
              $set: {
                currentVersion: nextVersion,
                status: "SUBMITTED",
                lastSubmittedAt: input.submittedAt,
                updatedAt: input.submittedAt,
                versions: {
                  $concatArrays: [
                    {$ifNull: ["$versions", []]},
                    [
                      {
                        version: nextVersion,
                        submittedAt: input.submittedAt,
                        metadata: {$literal: input.metadata}
                      }
                    ]
                  ]
                }
              }
            }
          ],
          {returnDocument: "after", updatePipeline: true}
        )
        .lean();

      if (!updated) return await this.classifyAppendMiss(input.id);
      warnWhenEmbeddedHistoryIsLarge(updated);

      const version = Array.isArray(updated.versions) ? updated.versions.at(-1) : undefined;
      return documentVersionOutput(version);
    } catch (error) {
      return err(mapAppendVersionMongoFailure(error));
    }
  }

  private async classifyAppendMiss(
    id: string
  ): Promise<Result<DocumentVersionOutput, CollaboratorDocumentFailure>> {
    const model = this.model();
    if (!model) return err(unavailable());

    const existing = await model.findById(id).select({deletedAt: 1, unlinkedAt: 1}).lean();
    if (!existing) {
      return err(
        collaboratorDocumentApplicationFailure(
          "COLLABORATOR_DOCUMENT_NOT_FOUND",
          "Collaborator document was not found."
        )
      );
    }
    if (existing.deletedAt) {
      return err(
        collaboratorDocumentApplicationFailure(
          "COLLABORATOR_DOCUMENT_DELETED",
          "Collaborator document was deleted."
        )
      );
    }
    return err(
      collaboratorDocumentApplicationFailure(
        "COLLABORATOR_DOCUMENT_UNLINKED",
        "Collaborator document was unlinked."
      )
    );
  }

  private async findByIdSafely(
    id: string
  ): Promise<Result<CollaboratorDocumentOutput, CollaboratorDocumentFailure>> {
    try {
      const model = this.model();
      if (!model) return err(unavailable());
      if (!Types.ObjectId.isValid(id)) {
        return err(
          collaboratorDocumentApplicationFailure(
            "COLLABORATOR_DOCUMENT_NOT_FOUND",
            "Collaborator document was not found."
          )
        );
      }

      const row = await model.findById(id).lean();
      return row
        ? collaboratorDocumentOutputFromMongoDocument(row as CollaboratorDocumentMongoRead)
        : err(
            collaboratorDocumentApplicationFailure(
              "COLLABORATOR_DOCUMENT_NOT_FOUND",
              "Collaborator document was not found."
            )
          );
    } catch (error) {
      return err(mapMongoFailure(error));
    }
  }

  private async listSafely(input: {
    filters: CollaboratorDocumentListFilters;
    afterId?: string;
    limit: number;
  }): Promise<Result<CollaboratorDocumentListPage, CollaboratorDocumentFailure>> {
    try {
      const model = this.model();
      if (!model) return err(unavailable());
      if (input.afterId && !Types.ObjectId.isValid(input.afterId)) {
        return err(
          collaboratorDocumentApplicationFailure(
            "INVALID_QUERY_PARAMETER",
            "cursor position is invalid",
            [{field: "cursor", code: "INVALID_CURSOR", message: "cursor position is invalid"}]
          )
        );
      }

      const filter = buildListFilter(input.filters);
      if (input.afterId) filter._id = {$gt: new Types.ObjectId(input.afterId)};

      const rows = await model
        .find(filter)
        .sort({_id: 1})
        .limit(input.limit + 1)
        .lean();
      const hasNext = rows.length > input.limit;
      const page = hasNext ? rows.slice(0, input.limit) : rows;
      const items: CollaboratorDocumentOutput[] = [];
      for (const row of page) {
        const mapped = collaboratorDocumentOutputFromMongoDocument(
          row as CollaboratorDocumentMongoRead
        );
        if (mapped.isErr()) return err(mapped.error);
        items.push(mapped.value);
      }
      return ok({items, hasNext});
    } catch (error) {
      return err(mapMongoFailure(error));
    }
  }

  private async unlinkActiveSafely(
    id: string,
    unlinkedAt: Date,
    updatedAt: Date
  ): Promise<Result<void, CollaboratorDocumentFailure>> {
    try {
      const model = this.model();
      if (!model) return err(unavailable());
      if (!Types.ObjectId.isValid(id)) {
        return err(
          collaboratorDocumentApplicationFailure(
            "COLLABORATOR_DOCUMENT_NOT_FOUND",
            "Collaborator document was not found."
          )
        );
      }

      const updated = await model
        .findOneAndUpdate(
          {_id: id, deletedAt: null, unlinkedAt: null},
          {$set: {unlinkedAt, updatedAt}},
          {returnDocument: "after"}
        )
        .lean();
      if (updated) return ok(undefined);

      const existing = await model.findById(id).lean();
      if (!existing) {
        return err(
          collaboratorDocumentApplicationFailure(
            "COLLABORATOR_DOCUMENT_NOT_FOUND",
            "Collaborator document was not found."
          )
        );
      }
      if (existing.deletedAt) {
        return err(
          collaboratorDocumentApplicationFailure(
            "COLLABORATOR_DOCUMENT_DELETED",
            "Collaborator document was deleted."
          )
        );
      }
      return err(
        collaboratorDocumentApplicationFailure(
          "COLLABORATOR_DOCUMENT_UNLINKED",
          "Collaborator document was unlinked."
        )
      );
    } catch (error) {
      return err(mapMongoFailure(error));
    }
  }
}

function buildListFilter(filters: CollaboratorDocumentListFilters): Record<string, unknown> {
  const filter: Record<string, unknown> = {};
  if (filters.collaboratorId) filter.collaboratorId = filters.collaboratorId;
  if (filters.documentTypeId) filter.documentTypeId = filters.documentTypeId;
  if (filters.status) filter.status = filters.status;

  switch (filters.lifecycle) {
    case "active":
      filter.deletedAt = null;
      filter.unlinkedAt = null;
      break;
    case "unlinked":
      filter.deletedAt = null;
      filter.unlinkedAt = {$ne: null};
      break;
    case "deleted":
      filter.deletedAt = {$ne: null};
      break;
    case "all":
      break;
  }
  return filter;
}

function mapMongoFailure(error: unknown): CollaboratorDocumentFailure {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error as {code?: number}).code === 11_000
  ) {
    return collaboratorDocumentApplicationFailure(
      "ACTIVE_LINK_ALREADY_EXISTS",
      "An active collaborator-document link already exists.",
      [
        {
          field: "documentTypeId",
          code: "DUPLICATE_ACTIVE_LINK",
          message: "An active link already exists for this collaborator and document type."
        }
      ]
    );
  }
  return collaboratorDocumentApplicationFailure(
    "INTERNAL_SERVER_ERROR",
    "Collaborator document persistence failed."
  );
}

function mapAppendVersionMongoFailure(error: unknown): CollaboratorDocumentFailure {
  if (isDocumentHistoryCapacityError(error)) {
    return collaboratorDocumentApplicationFailure(
      "DOCUMENT_HISTORY_LIMIT_REACHED",
      "The embedded document history reached its physical capacity."
    );
  }
  return mapMongoFailure(error);
}

function isDocumentHistoryCapacityError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as {code?: number; codeName?: string; message?: string};
  return (
    candidate.code === 10_334 ||
    candidate.codeName === "BSONObjectTooLarge" ||
    /BSONObj size|object to insert too large|document is larger than/i.test(candidate.message ?? "")
  );
}

function documentVersionOutput(
  value: unknown
): Result<DocumentVersionOutput, CollaboratorDocumentFailure> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return err(invalidVersionPersistenceData());
  }
  const candidate = value as Record<string, unknown>;
  const metadata = candidate.metadata;
  if (
    !Number.isInteger(candidate.version) ||
    (candidate.version as number) < 1 ||
    !(candidate.submittedAt instanceof Date) ||
    !metadata ||
    typeof metadata !== "object" ||
    Array.isArray(metadata)
  ) {
    return err(invalidVersionPersistenceData());
  }
  const normalizedMetadata = metadata as Record<string, unknown>;
  if (
    typeof normalizedMetadata.originalName !== "string" ||
    !isNullableString(normalizedMetadata.mimeType) ||
    !isNullableNonNegativeInteger(normalizedMetadata.sizeBytes) ||
    !isNullableString(normalizedMetadata.storageKey) ||
    !isNullableString(normalizedMetadata.notes)
  ) {
    return err(invalidVersionPersistenceData());
  }

  return ok({
    version: candidate.version as number,
    submittedAt: candidate.submittedAt.toISOString(),
    metadata: {
      originalName: normalizedMetadata.originalName,
      mimeType: normalizedMetadata.mimeType,
      sizeBytes: normalizedMetadata.sizeBytes,
      storageKey: normalizedMetadata.storageKey,
      notes: normalizedMetadata.notes
    }
  });
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isNullableNonNegativeInteger(value: unknown): value is number | null {
  return value === null || (Number.isInteger(value) && (value as number) >= 0);
}

function invalidVersionPersistenceData(): CollaboratorDocumentFailure {
  return collaboratorDocumentApplicationFailure(
    "INTERNAL_SERVER_ERROR",
    "Document version persistence data is invalid."
  );
}

function warnWhenEmbeddedHistoryIsLarge(document: unknown): void {
  try {
    if (BSON.calculateObjectSize(document as Document) > embeddedHistoryWarningBytes) {
      $log.warn({
        event: "DOCUMENT_VERSION_HISTORY_CAPACITY_WARNING",
        operationId: "createDocumentVersion"
      });
    }
  } catch {
    // Best-effort observability must not change a confirmed write result.
  }
}
