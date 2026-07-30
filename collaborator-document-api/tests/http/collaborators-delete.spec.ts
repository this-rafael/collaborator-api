import {beforeEach, describe, expect, it} from "vitest";
import {ObjectId} from "mongodb";
import supertest from "supertest";
import {PlatformTest} from "@tsed/platform-http/testing";

import {resetDatabase} from "../helpers/database.js";
import {bootstrapHttpMongo, httpDatabase} from "../helpers/http-mongo.js";

const id = "66a64ab05bd7213b90d9b001";

// COL-DELETE-001…008
describe("Deleting a collaborator", () => {
  bootstrapHttpMongo();

  beforeEach(async () => {
    const db = httpDatabase();
    await resetDatabase(db);
    const now = new Date("2026-07-29T12:00:00.000Z");
    await db.collection("collaborators").insertOne({
      _id: new ObjectId(id),
      name: "Ana Silva",
      nameNormalized: "ana silva",
      cpf: "12345678909",
      email: "ana@example.com",
      deletedAt: null,
      createdAt: now,
      updatedAt: now
    });
    await db
      .collection("collaborator_documents")
      .insertOne({collaboratorId: id, deletedAt: null, versions: [{version: 1}]});
  });

  it("soft deletes the collaborator and active links without a body", async () => {
    const response = await supertest(PlatformTest.callback())
      .delete(`/api/v1/collaborators/${id}`)
      .expect(204);
    expect(response.text).toBe("");
    expect(
      (
        await httpDatabase()
          .collection("collaborators")
          .findOne({_id: new ObjectId(id)})
      )?.deletedAt
    ).not.toBeNull();
    expect(
      (await httpDatabase().collection("collaborator_documents").findOne({collaboratorId: id}))
        ?.deletedAt
    ).not.toBeNull();
  });

  it("keeps a repeated delete idempotent", async () => {
    await supertest(PlatformTest.callback()).delete(`/api/v1/collaborators/${id}`).expect(204);
    const first = (
      await httpDatabase()
        .collection("collaborators")
        .findOne({_id: new ObjectId(id)})
    )?.deletedAt;
    await supertest(PlatformTest.callback()).delete(`/api/v1/collaborators/${id}`).expect(204);
    expect(
      (
        await httpDatabase()
          .collection("collaborators")
          .findOne({_id: new ObjectId(id)})
      )?.deletedAt
    ).toEqual(first);
  });

  it("rejects malformed and unknown identifiers", async () => {
    await supertest(PlatformTest.callback()).delete("/api/v1/collaborators/nope").expect(400);
    const response = await supertest(PlatformTest.callback())
      .delete("/api/v1/collaborators/66a64ab05bd7213b90d9b099")
      .expect(404);
    expect(response.body.code).toBe("COLLABORATOR_NOT_FOUND");
  });
});
