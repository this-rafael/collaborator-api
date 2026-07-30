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
});
