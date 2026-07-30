import {beforeEach, describe, expect, it} from "vitest";
import {ObjectId} from "mongodb";
import supertest from "supertest";
import {PlatformTest} from "@tsed/platform-http/testing";

import {resetDatabase} from "../helpers/database.js";
import {bootstrapHttpMongo, httpDatabase} from "../helpers/http-mongo.js";

const id = "66a64ab05bd7213b90d9b001";

// COL-PATCH-001…024
describe("Updating a collaborator", () => {
  bootstrapHttpMongo();

  beforeEach(async () => {
    const db = httpDatabase();
    await resetDatabase(db);
    const now = new Date("2026-07-29T12:00:00.000Z");
    await db.collection("collaborators").insertMany([
      {
        _id: new ObjectId(id),
        name: "Ana Silva",
        nameNormalized: "ana silva",
        cpf: "12345678909",
        email: "ana@example.com",
        deletedAt: null,
        createdAt: now,
        updatedAt: now
      },
      {
        _id: new ObjectId("66a64ab05bd7213b90d9b002"),
        name: "Histórico",
        nameNormalized: "historico",
        cpf: "98765432100",
        email: "history@example.com",
        deletedAt: now,
        createdAt: now,
        updatedAt: now
      }
    ]);
  });

  it.each([{name: "Ana Souza"}, {cpf: "11111111111"}, {email: "ana.souza@example.com"}])(
    "updates only supplied fields",
    async (body) => {
      const response = await supertest(PlatformTest.callback())
        .patch(`/api/v1/collaborators/${id}`)
        .send(body)
        .expect(200);
      expect(response.headers.etag).toMatch(/^W\/"sha256:[a-f0-9]{64}"$/);
      expect(response.body.createdAt).toBe("2026-07-29T12:00:00.000Z");
    }
  );

  it.each([
    {},
    {unexpected: true},
    {name: ""},
    {name: "a".repeat(201)},
    {cpf: "bad"},
    {email: "bad"}
  ])("rejects invalid partial updates", async (body) => {
    await supertest(PlatformTest.callback())
      .patch(`/api/v1/collaborators/${id}`)
      .send(body)
      .expect(422);
  });

  it("maps id, media type, not found and deleted state", async () => {
    await supertest(PlatformTest.callback())
      .patch("/api/v1/collaborators/nope")
      .send({name: "Ana"})
      .expect(400);
    await supertest(PlatformTest.callback())
      .patch(`/api/v1/collaborators/${id}`)
      .set("Content-Type", "text/plain")
      .send("text")
      .expect(415);
    await supertest(PlatformTest.callback())
      .patch("/api/v1/collaborators/66a64ab05bd7213b90d9b099")
      .send({name: "Ana"})
      .expect(404);
    await supertest(PlatformTest.callback())
      .patch("/api/v1/collaborators/66a64ab05bd7213b90d9b002")
      .send({name: "Ana"})
      .expect(410);
  });
});
