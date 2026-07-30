import {beforeEach, describe, expect, it} from "vitest";
import {ObjectId} from "mongodb";
import supertest from "supertest";
import {PlatformTest} from "@tsed/platform-http/testing";

import {resetDatabase} from "../helpers/database.js";
import {bootstrapHttpMongo, httpDatabase} from "../helpers/http-mongo.js";

// COL-LIST-001…020, CURSOR-001, CURSOR-002
describe("Listing collaborators", () => {
  bootstrapHttpMongo();

  beforeEach(async () => {
    const db = httpDatabase();
    await resetDatabase(db);
    await db
      .collection("collaborators")
      .insertMany([
        collaborator("66a64ab05bd7213b90d9b001", "Ána Silva", "12345678909", "ana@example.com"),
        collaborator("66a64ab05bd7213b90d9b002", "Bruno Lima", "98765432100", "bruno@example.com"),
        collaborator(
          "66a64ab05bd7213b90d9b003",
          "Histórico",
          "11111111111",
          "history@example.com",
          new Date()
        )
      ]);
  });

  it("returns only active collaborators and a HAL collection", async () => {
    const response = await supertest(PlatformTest.callback())
      .get("/api/v1/collaborators")
      .expect(200);
    expect(response.headers.etag).toMatch(/^W\/"sha256:[a-f0-9]{64}"$/);
    expect(response.body.count).toBe(2);
    expect(
      response.body._embedded.collaborators.map((item: {id: string}) => item.id)
    ).not.toContain("66a64ab05bd7213b90d9b003");
  });

  it("normalizes name and email filters and combines filters with AND", async () => {
    await supertest(PlatformTest.callback())
      .get("/api/v1/collaborators?name=ana%20%20silva")
      .expect(200)
      .expect(({body}) => expect(body.count).toBe(1));
    await supertest(PlatformTest.callback())
      .get("/api/v1/collaborators?email=ANA%40EXAMPLE.COM")
      .expect(200)
      .expect(({body}) => expect(body.count).toBe(1));
    await supertest(PlatformTest.callback())
      .get("/api/v1/collaborators?name=ana&cpf=12345678909")
      .expect(200)
      .expect(({body}) => expect(body.count).toBe(1));
  });

  it.each(["?cpf=123", "?email=invalid", "?limit=0", "?limit=101", "?limit=one", "?cursor="])(
    "rejects invalid list parameters",
    async (query) => {
      const response = await supertest(PlatformTest.callback())
        .get(`/api/v1/collaborators${query}`)
        .expect(400);
      expect(response.body.code).toBe("INVALID_QUERY_PARAMETER");
    }
  );

  it("continues a keyset page without duplicates", async () => {
    const first = await supertest(PlatformTest.callback())
      .get("/api/v1/collaborators?limit=1")
      .expect(200);
    const second = await supertest(PlatformTest.callback())
      .get(first.body._links.next.href)
      .expect(200);
    expect(second.body._embedded.collaborators[0].id).not.toBe(
      first.body._embedded.collaborators[0].id
    );
  });

  it("returns a bodyless cache hit", async () => {
    const first = await supertest(PlatformTest.callback()).get("/api/v1/collaborators").expect(200);
    await supertest(PlatformTest.callback())
      .get("/api/v1/collaborators")
      .set("If-None-Match", first.headers.etag!)
      .expect(304);
  });
});

function collaborator(
  id: string,
  name: string,
  cpf: string,
  email: string,
  deletedAt: Date | null = null
) {
  const now = new Date("2026-07-29T12:00:00.000Z");
  return {
    _id: new ObjectId(id),
    name,
    nameNormalized: name
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase(),
    cpf,
    email,
    deletedAt,
    createdAt: now,
    updatedAt: now
  };
}
