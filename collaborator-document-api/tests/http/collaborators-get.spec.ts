import {beforeEach, describe, expect, it} from "vitest";
import {ObjectId} from "mongodb";
import supertest from "supertest";
import {PlatformTest} from "@tsed/platform-http/testing";

import {resetDatabase} from "../helpers/database.js";
import {bootstrapHttpMongo, httpDatabase} from "../helpers/http-mongo.js";

const activeId = "66a64ab05bd7213b90d9b001";
const deletedId = "66a64ab05bd7213b90d9b002";

// COL-GET-001…008
describe("Getting a collaborator", () => {
  bootstrapHttpMongo();

  beforeEach(async () => {
    const db = httpDatabase();
    await resetDatabase(db);
    const now = new Date("2026-07-29T12:00:00.000Z");
    await db.collection("collaborators").insertMany([
      {
        _id: new ObjectId(activeId),
        name: "Ana Silva",
        nameNormalized: "ana silva",
        cpf: "12345678909",
        email: "ana@example.com",
        deletedAt: null,
        createdAt: now,
        updatedAt: now
      },
      {
        _id: new ObjectId(deletedId),
        name: "Ana História",
        nameNormalized: "ana historia",
        cpf: "98765432100",
        email: "history@example.com",
        deletedAt: now,
        createdAt: now,
        updatedAt: now
      }
    ]);
  });

  it("returns an active collaborator with mutation links and an ETag", async () => {
    const response = await supertest(PlatformTest.callback())
      .get(`/api/v1/collaborators/${activeId}`)
      .expect(200);
    expect(response.body.deletedAt).toBeNull();
    expect(response.body._links).toMatchObject({
      update: expect.anything(),
      delete: expect.anything()
    });
    expect(response.headers.etag).toMatch(/^W\/"sha256:[a-f0-9]{64}"$/);
  });

  it("returns deleted history without mutation links", async () => {
    const response = await supertest(PlatformTest.callback())
      .get(`/api/v1/collaborators/${deletedId}`)
      .expect(200);
    expect(response.body.deletedAt).not.toBeNull();
    expect(response.body._links.update).toBeUndefined();
    expect(response.body._links.delete).toBeUndefined();
  });

  it("rejects malformed and unknown identifiers", async () => {
    await supertest(PlatformTest.callback()).get("/api/v1/collaborators/nope").expect(400);
    const missing = await supertest(PlatformTest.callback())
      .get("/api/v1/collaborators/66a64ab05bd7213b90d9b099")
      .expect(404);
    expect(missing.body.code).toBe("COLLABORATOR_NOT_FOUND");
  });

  it("returns a bodyless cache hit for an unchanged representation", async () => {
    const first = await supertest(PlatformTest.callback())
      .get(`/api/v1/collaborators/${activeId}`)
      .expect(200);
    await supertest(PlatformTest.callback())
      .get(`/api/v1/collaborators/${activeId}`)
      .set("If-None-Match", first.headers.etag!)
      .expect(304);
  });
});
