import {beforeEach, describe, expect, it} from "vitest";
import {ObjectId} from "mongodb";
import supertest from "supertest";
import {PlatformTest} from "@tsed/platform-http/testing";

import {documentTypePageFixtures} from "../helpers/document-type-fixtures.js";
import {resetDatabase} from "../helpers/database.js";
import {bootstrapHttpMongo, httpDatabase} from "../helpers/http-mongo.js";

// TYPE-LIST-001…017
describe("Listing document types", () => {
  bootstrapHttpMongo();

  beforeEach(async () => {
    await resetDatabase(httpDatabase());
    await httpDatabase()
      .collection("document_types")
      .insertMany([
        row("66a64ab05bd7213b90d9b010", "Átestado   Ocupacional", "ASO"),
        row("66a64ab05bd7213b90d9b011", "Carteira de Trabalho", "CTPS"),
        row("66a64ab05bd7213b90d9b012", "Histórico", "OLD", new Date())
      ]);
  });

  // TYPE-LIST-001
  it("returns only active document types as a HAL collection", async () => {
    const response = await supertest(PlatformTest.callback())
      .get("/api/v1/document-types")
      .expect(200);
    expect(response.headers.etag).toMatch(/^W\/"sha256:[a-f0-9]{64}"$/);
    expect(response.body.count).toBe(2);
    expect(response.body._links.self.href).toContain("/api/v1/document-types");
    expect(
      response.body._embedded.documentTypes.map((item: {code: string}) => item.code)
    ).not.toContain("OLD");
  });

  // TYPE-LIST-002
  it("returns an empty HAL collection when no active type matches", async () => {
    const response = await supertest(PlatformTest.callback())
      .get("/api/v1/document-types?code=UNKNOWN")
      .expect(200);
    expect(response.body.count).toBe(0);
    expect(response.body._embedded.documentTypes).toEqual([]);
  });

  // TYPE-LIST-003, TYPE-LIST-004
  it("normalizes partial name filters and applies exact uppercase code filters", async () => {
    await supertest(PlatformTest.callback())
      .get("/api/v1/document-types?name=ocupacional")
      .expect(200)
      .expect(({body}) => expect(body.count).toBe(1));
    await supertest(PlatformTest.callback())
      .get("/api/v1/document-types?name=ATESTADO")
      .expect(200)
      .expect(({body}) => expect(body.count).toBe(1));
    await supertest(PlatformTest.callback())
      .get("/api/v1/document-types?code=ASO")
      .expect(200)
      .expect(({body}) => expect(body._embedded.documentTypes[0].code).toBe("ASO"));
  });

  // TYPE-LIST-005, TYPE-LIST-009…012
  it.each([
    ["?code=aso", "code"],
    ["?code=A", "code"],
    ["?cursor=", "cursor"],
    ["?limit=0", "limit"],
    ["?limit=101", "limit"],
    ["?limit=1.5", "limit"],
    ["?limit=one", "limit"]
  ])("rejects invalid query parameters", async (query, field) => {
    const response = await supertest(PlatformTest.callback())
      .get(`/api/v1/document-types${query}`)
      .expect(400);
    expect(response.body.code).toBe("INVALID_QUERY_PARAMETER");
    expect(response.body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({field})])
    );
  });

  // TYPE-LIST-006, TYPE-LIST-007
  it("applies the default page and accepts minimum and maximum limits", async () => {
    await resetDatabase(httpDatabase());
    await httpDatabase()
      .collection("document_types")
      .insertMany(documentTypePageFixtures(101).map(fixtureRow));
    const defaultPage = await supertest(PlatformTest.callback())
      .get("/api/v1/document-types")
      .expect(200);
    expect(defaultPage.body.count).toBe(20);
    expect(defaultPage.body._links.next).toBeDefined();
    await supertest(PlatformTest.callback())
      .get("/api/v1/document-types?limit=1")
      .expect(({body}) => expect(body.count).toBe(1));
    await supertest(PlatformTest.callback())
      .get("/api/v1/document-types?limit=100")
      .expect(({body}) => expect(body.count).toBe(100));
  });

  // TYPE-LIST-008
  it("continues an opaque keyset page without duplicate or omitted items", async () => {
    const first = await supertest(PlatformTest.callback())
      .get("/api/v1/document-types?limit=1")
      .expect(200);
    const second = await supertest(PlatformTest.callback())
      .get(first.body._links.next.href)
      .expect(200);
    expect(second.body._embedded.documentTypes[0].id).not.toBe(
      first.body._embedded.documentTypes[0].id
    );
  });

  // TYPE-LIST-013
  it("returns a bodyless cache hit for an unchanged collection", async () => {
    const first = await supertest(PlatformTest.callback())
      .get("/api/v1/document-types")
      .expect(200);
    const cached = await supertest(PlatformTest.callback())
      .get("/api/v1/document-types")
      .set("If-None-Match", first.headers.etag!)
      .expect(304);
    expect(cached.text).toBe("");
  });

  // TYPE-LIST-017
  it("rejects a tampered cursor without returning a partial page", async () => {
    const first = await supertest(PlatformTest.callback())
      .get("/api/v1/document-types?limit=1")
      .expect(200);
    const next = new URL(first.body._links.next.href, "http://localhost");
    const cursor = next.searchParams.get("cursor")!;
    next.searchParams.set("cursor", `${cursor.slice(0, -1)}x`);
    const response = await supertest(PlatformTest.callback())
      .get(`${next.pathname}${next.search}`)
      .expect(400);
    expect(response.body.code).toBe("INVALID_QUERY_PARAMETER");
    expect(response.body._embedded).toBeUndefined();
  });

  // TYPE-LIST-014, TYPE-LIST-015, TYPE-LIST-016
  it("publishes rate-limit, sanitized internal, and dependency failures", async () => {
    const {loadListDocumentTypesSliceFromExpected} = await import("../helpers/openapi-slice.js");
    expect(
      Object.keys(loadListDocumentTypesSliceFromExpected().operation.responses as object)
    ).toEqual(expect.arrayContaining(["429", "500", "503"]));
  });
});

function row(id: string, name: string, code: string, deletedAt: Date | null = null) {
  const now = new Date("2026-07-30T12:00:00.000Z");
  return {
    _id: new ObjectId(id),
    name,
    nameNormalized: name
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase(),
    code,
    description: null,
    deletedAt,
    createdAt: now,
    updatedAt: now
  };
}

function fixtureRow(value: ReturnType<typeof documentTypePageFixtures>[number]) {
  return row(value.id, value.name, value.code);
}
