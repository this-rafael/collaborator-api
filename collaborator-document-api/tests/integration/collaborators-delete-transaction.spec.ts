import {beforeEach, describe, expect, it} from "vitest";
import {ObjectId} from "mongodb";
import {PlatformTest} from "@tsed/platform-http/testing";

import {CollaboratorsRuntime} from "../../src/modules/collaborators/collaborators.runtime.js";
import {resetDatabase} from "../helpers/database.js";
import {bootstrapHttpMongo, httpDatabase} from "../helpers/http-mongo.js";

const collaboratorId = "66a64ab05bd7213b90d9b001";

describe("Deleting collaborators transactionally", () => {
  bootstrapHttpMongo();

  beforeEach(async () => resetDatabase(httpDatabase()));

  it("commits collaborator and active-link soft deletes together while preserving versions", async () => {
    await seedActiveCollaborator();

    const result = await PlatformTest.get<CollaboratorsRuntime>(
      CollaboratorsRuntime
    ).application.delete.execute({id: collaboratorId});

    expect(result.isOk()).toBe(true);
    const db = httpDatabase();
    const collaborator = await db
      .collection("collaborators")
      .findOne({_id: new ObjectId(collaboratorId)});
    const activeLink = await db.collection("collaborator_documents").findOne({collaboratorId});

    expect(collaborator?.deletedAt).toBeInstanceOf(Date);
    expect(activeLink?.deletedAt).toEqual(collaborator?.deletedAt);
    expect(activeLink?.versions).toEqual([{version: 1, payload: "preserved"}]);
  });

  it("is idempotent and never overwrites the original cascade timestamp", async () => {
    await seedActiveCollaborator();
    const application = PlatformTest.get<CollaboratorsRuntime>(CollaboratorsRuntime).application;

    expect((await application.delete.execute({id: collaboratorId})).isOk()).toBe(true);
    const first = await httpDatabase()
      .collection("collaborator_documents")
      .findOne({collaboratorId});
    expect((await application.delete.execute({id: collaboratorId})).isOk()).toBe(true);
    const repeated = await httpDatabase()
      .collection("collaborator_documents")
      .findOne({collaboratorId});

    expect(repeated?.deletedAt).toEqual(first?.deletedAt);
    expect(repeated?.versions).toEqual(first?.versions);
  });

  it("rolls back the collaborator update when the document cascade returns a modeled failure", async () => {
    const db = httpDatabase();
    await db
      .collection("collaborator_documents")
      .drop()
      .catch(() => undefined);
    await db.createCollection("collaborator_documents", {
      validator: {
        $jsonSchema: {
          bsonType: "object",
          properties: {deletedAt: {bsonType: "null"}}
        }
      }
    });
    await seedActiveCollaborator();

    const result = await PlatformTest.get<CollaboratorsRuntime>(
      CollaboratorsRuntime
    ).application.delete.execute({id: collaboratorId});

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe("INTERNAL_SERVER_ERROR");
    const collaborator = await db
      .collection("collaborators")
      .findOne({_id: new ObjectId(collaboratorId)});
    const activeLink = await db.collection("collaborator_documents").findOne({collaboratorId});
    expect(collaborator?.deletedAt).toBeNull();
    expect(activeLink?.deletedAt).toBeNull();
  });
});

async function seedActiveCollaborator(): Promise<void> {
  const db = httpDatabase();
  const now = new Date("2026-07-29T12:00:00.000Z");
  await db.collection("collaborators").insertOne({
    _id: new ObjectId(collaboratorId),
    name: "Ana Silva",
    nameNormalized: "ana silva",
    cpf: "12345678909",
    email: "ana@example.com",
    deletedAt: null,
    createdAt: now,
    updatedAt: now
  });
  await db.collection("collaborator_documents").insertOne({
    collaboratorId,
    deletedAt: null,
    versions: [{version: 1, payload: "preserved"}]
  });
}
