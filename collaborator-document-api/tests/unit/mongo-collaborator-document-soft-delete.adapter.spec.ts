import type {ClientSession} from "mongoose";
import {beforeEach, describe, expect, it, vi} from "vitest";

const requireMongooseConnection = vi.hoisted(() => vi.fn());

vi.mock("../../src/shared/infrastructure/mongo/mongoose-connection.js", () => ({
  requireMongooseConnection
}));

describe("MongoCollaboratorDocumentSoftDeleteAdapter", () => {
  beforeEach(() => {
    requireMongooseConnection.mockReset();
  });

  it("throws when the mongoose connection has no database", async () => {
    requireMongooseConnection.mockReturnValue({db: undefined});
    const {MongoCollaboratorDocumentSoftDeleteAdapter} =
      await import("../../src/modules/collaborators/infrastructure/adapters/mongo-collaborator-document-soft-delete.adapter.js");

    await expect(
      new MongoCollaboratorDocumentSoftDeleteAdapter().softDeleteActiveByCollaboratorId(
        {} as ClientSession,
        "66a64ab05bd7213b90d9b001",
        new Date("2026-07-29T12:00:00.000Z")
      )
    ).rejects.toThrow("MongoDB database is not available");
  });
});
