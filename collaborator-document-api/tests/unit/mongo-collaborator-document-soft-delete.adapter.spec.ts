import type {MongooseService} from "@tsed/mongoose";
import type {ClientSession} from "mongoose";
import {describe, expect, it, vi} from "vitest";

import {MongoCollaboratorDocumentRepository} from "../../src/modules/collaborator-documents/infrastructure/persistence/mongodb/collaborator-document.mongo-repository.js";
import {createMongoTransactionContext} from "../../src/shared/infrastructure/persistence/mongodb/mongo-transaction-context.js";

const collaboratorId = "66a64ab05bd7213b90d9b001";
const deletedAt = new Date("2026-07-29T12:00:00.000Z");
const transactionContext = () => createMongoTransactionContext({} as ClientSession);

describe("MongoCollaboratorDocumentRepository", () => {
  it("returns a modeled failure when no Mongo transaction context is available", async () => {
    const repository = new MongoCollaboratorDocumentRepository({
      get: () => undefined
    } as MongooseService);

    const result = await repository.softDeleteActiveByCollaboratorId(
      collaboratorId,
      deletedAt,
      {} as never
    );

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe("SERVICE_UNAVAILABLE");
  });

  it("returns SERVICE_UNAVAILABLE when the database is unavailable", async () => {
    const repository = new MongoCollaboratorDocumentRepository({
      get: () => ({db: undefined})
    } as MongooseService);

    const result = await repository.softDeleteActiveByCollaboratorId(
      collaboratorId,
      deletedAt,
      transactionContext()
    );

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe("SERVICE_UNAVAILABLE");
  });

  it("soft-deletes only active document links in the supplied transaction", async () => {
    const updateMany = vi.fn(async () => ({modifiedCount: 2}));
    const collection = vi.fn(() => ({updateMany}));
    const repository = new MongoCollaboratorDocumentRepository({
      get: () => ({db: {collection}})
    } as unknown as MongooseService);
    const context = transactionContext();

    const result = await repository.softDeleteActiveByCollaboratorId(
      collaboratorId,
      deletedAt,
      context
    );

    expect(result.isOk()).toBe(true);
    expect(collection).toHaveBeenCalledWith("collaborator_documents");
    expect(updateMany).toHaveBeenCalledWith(
      {collaboratorId, deletedAt: null},
      {$set: {deletedAt}},
      {session: expect.anything()}
    );
  });

  it("maps a persistence exception to a modeled internal failure", async () => {
    const repository = new MongoCollaboratorDocumentRepository({
      get: () => ({
        db: {
          collection: () => ({
            updateMany: async () => {
              throw new Error("write failed");
            }
          })
        }
      })
    } as unknown as MongooseService);

    const result = await repository.softDeleteActiveByCollaboratorId(
      collaboratorId,
      deletedAt,
      transactionContext()
    );

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe("INTERNAL_SERVER_ERROR");
  });

  it("returns SERVICE_UNAVAILABLE when CRUD helpers lack an active connection", async () => {
    const repository = new MongoCollaboratorDocumentRepository({
      get: () => undefined
    } as MongooseService);
    const document = (
      await import("../../src/modules/collaborator-documents/domain/aggregates/collaborator-document.js")
    ).CollaboratorDocument.createPendingCycle(
      {
        id: "66a64ab05bd7213b90d9c001",
        collaboratorId,
        documentTypeId: "66a64ab05bd7213b90d9b010"
      },
      deletedAt
    )._unsafeUnwrap();

    const results = await Promise.all([
      repository.create(document, {} as never),
      repository.findById("66a64ab05bd7213b90d9c001"),
      repository.list({filters: {lifecycle: "active"}, limit: 20}),
      repository.unlinkActive("66a64ab05bd7213b90d9c001", deletedAt, deletedAt)
    ]);

    for (const result of results) {
      expect(result.isErr()).toBe(true);
      if (result.isErr()) expect(result.error.code).toBe("SERVICE_UNAVAILABLE");
    }
  });

  // BDD gap: LINK-CREATE does not yet assert that the insert belongs to the parent reservation transaction.
  it("creates a document link with the supplied transaction session", async () => {
    const document = (
      await import("../../src/modules/collaborator-documents/domain/aggregates/collaborator-document.js")
    ).CollaboratorDocument.createPendingCycle(
      {
        id: "66a64ab05bd7213b90d9c001",
        collaboratorId,
        documentTypeId: "66a64ab05bd7213b90d9b010"
      },
      deletedAt
    )._unsafeUnwrap();
    const create = vi.fn(async () => [
      {
        toObject: () => ({
          _id: {toString: () => document.id},
          collaboratorId,
          documentTypeId: "66a64ab05bd7213b90d9b010",
          status: "PENDING",
          currentVersion: 0,
          versions: [],
          lastSubmittedAt: null,
          linkedAt: deletedAt,
          unlinkedAt: null,
          createdAt: deletedAt,
          updatedAt: deletedAt,
          deletedAt: null
        })
      }
    ]);
    const repository = new MongoCollaboratorDocumentRepository({
      get: () => ({readyState: 1, models: {CollaboratorDocument: {create}}})
    } as unknown as MongooseService);
    const context = transactionContext();

    const result = await repository.create(document, context);

    expect(result.isOk()).toBe(true);
    expect(create).toHaveBeenCalledWith([expect.anything()], {session: expect.anything()});
  });

  it("treats invalid identifiers as not-found for get and unlink", async () => {
    const repository = new MongoCollaboratorDocumentRepository({
      get: () => ({
        readyState: 1,
        models: {
          CollaboratorDocument: {
            findById: () => ({lean: async () => null}),
            findOneAndUpdate: async () => null
          }
        }
      })
    } as unknown as MongooseService);

    const find = await repository.findById("not-an-object-id");
    const unlink = await repository.unlinkActive("not-an-object-id", deletedAt, deletedAt);

    expect(find.isErr()).toBe(true);
    if (find.isErr()) expect(find.error.code).toBe("COLLABORATOR_DOCUMENT_NOT_FOUND");
    expect(unlink.isErr()).toBe(true);
    if (unlink.isErr()) expect(unlink.error.code).toBe("COLLABORATOR_DOCUMENT_NOT_FOUND");
  });

  it("rejects invalid afterId values during list", async () => {
    const repository = new MongoCollaboratorDocumentRepository({
      get: () => ({
        readyState: 1,
        models: {
          CollaboratorDocument: {
            find: () => ({
              sort: () => ({
                limit: () => ({
                  lean: async () => []
                })
              })
            })
          }
        }
      })
    } as unknown as MongooseService);

    const result = await repository.list({
      filters: {lifecycle: "active"},
      afterId: "bad-cursor",
      limit: 20
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe("INVALID_QUERY_PARAMETER");
  });
});
