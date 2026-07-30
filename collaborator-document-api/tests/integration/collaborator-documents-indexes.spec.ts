import {beforeEach, describe, expect, it} from "vitest";
import {MongooseService} from "@tsed/mongoose";
import {ObjectId} from "mongodb";
import {PlatformTest} from "@tsed/platform-http/testing";

import {resetDatabase} from "../helpers/database.js";
import {bootstrapHttpMongo, httpDatabase} from "../helpers/http-mongo.js";

describe("Collaborator document persistence indexes", () => {
  bootstrapHttpMongo();

  beforeEach(async () => resetDatabase(httpDatabase()));

  // LINK-CREATE-002 / LINK-CREATE-013
  it("provisions a partial unique active pair index that allows relink after unlink", async () => {
    const modulePath =
      "../../src/modules/collaborator-documents/infrastructure/persistence/mongodb/collaborator-document.indexes.js";
    const module = await import(modulePath);
    const mongoose = PlatformTest.get<MongooseService>(MongooseService);

    const result = await module.ensureCollaboratorDocumentIndexes(mongoose);
    expect(result.isOk()).toBe(true);

    const indexes = await httpDatabase()
      .collection("collaborator_documents")
      .listIndexes()
      .toArray();
    expect(indexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          unique: true,
          key: {collaboratorId: 1, documentTypeId: 1},
          partialFilterExpression: {deletedAt: null, unlinkedAt: null}
        })
      ])
    );

    const collaboratorId = "66a64ab05bd7213b90d9b001";
    const documentTypeId = "66a64ab05bd7213b90d9b010";
    const now = new Date("2026-07-30T12:00:00.000Z");

    await httpDatabase()
      .collection("collaborator_documents")
      .insertOne(
        row("66a64ab05bd7213b90d9c001", {
          collaboratorId,
          documentTypeId,
          unlinkedAt: now,
          deletedAt: null
        })
      );

    await expect(
      httpDatabase()
        .collection("collaborator_documents")
        .insertOne(
          row("66a64ab05bd7213b90d9c002", {
            collaboratorId,
            documentTypeId,
            unlinkedAt: null,
            deletedAt: null
          })
        )
    ).resolves.toMatchObject({acknowledged: true});

    await expect(
      httpDatabase()
        .collection("collaborator_documents")
        .insertOne(
          row("66a64ab05bd7213b90d9c003", {
            collaboratorId,
            documentTypeId,
            unlinkedAt: null,
            deletedAt: null
          })
        )
    ).rejects.toMatchObject({code: 11_000});
  });
});

function row(
  id: string,
  overrides: {
    collaboratorId: string;
    documentTypeId: string;
    unlinkedAt: Date | null;
    deletedAt: Date | null;
  }
) {
  const now = new Date("2026-07-30T12:00:00.000Z");
  return {
    _id: new ObjectId(id),
    collaboratorId: overrides.collaboratorId,
    documentTypeId: overrides.documentTypeId,
    status: "PENDING",
    currentVersion: 0,
    versions: [],
    lastSubmittedAt: null,
    linkedAt: now,
    unlinkedAt: overrides.unlinkedAt,
    createdAt: now,
    updatedAt: now,
    deletedAt: overrides.deletedAt
  };
}
