import {beforeEach, describe, expect, it} from "vitest";
import {ObjectId} from "mongodb";
import supertest from "supertest";
import {PlatformTest} from "@tsed/platform-http/testing";

import {resetDatabase} from "../helpers/database.js";
import {bootstrapHttpMongo, httpDatabase} from "../helpers/http-mongo.js";

const activeId = "66a64ab05bd7213b90d9b010";
const deletedId = "66a64ab05bd7213b90d9b011";

describe("Getting a document type", () => {
  bootstrapHttpMongo();

  beforeEach(async () => {
    await resetDatabase(httpDatabase());
    const now = new Date("2026-07-30T12:00:00.000Z");
    await httpDatabase()
      .collection("document_types")
      .insertMany([
        row(activeId, "Atestado de Saúde Ocupacional", "ASO", null, now),
        row(deletedId, "Atestado histórico", "OLD_ASO", now, now)
      ]);
  });

  it("returns an active document type with mutation links and an ETag", async () => {
    const response = await supertest(PlatformTest.callback())
      .get(`/api/v1/document-types/${activeId}`)
      .expect(200);
    expect(response.body.deletedAt).toBeNull();
    expect(response.body._links).toMatchObject({
      self: expect.anything(),
      collection: expect.anything(),
      update: {method: "PATCH"},
      delete: {method: "DELETE"}
    });
    expect(response.headers.etag).toMatch(/^W\/"sha256:[a-f0-9]{64}"$/);
  });

  it("returns a deleted document type as immutable history", async () => {
    const response = await supertest(PlatformTest.callback())
      .get(`/api/v1/document-types/${deletedId}`)
      .expect(200);
    expect(response.body.deletedAt).not.toBeNull();
    expect(response.body._links.update).toBeUndefined();
    expect(response.body._links.delete).toBeUndefined();
  });

  it("rejects malformed identifiers and maps unknown identifiers to not found", async () => {
    const invalid = await supertest(PlatformTest.callback())
      .get("/api/v1/document-types/nope")
      .expect(400);
    expect(invalid.body.code).toBe("INVALID_OBJECT_ID");
    expect(invalid.body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({field: "id"})])
    );

    const missing = await supertest(PlatformTest.callback())
      .get("/api/v1/document-types/66a64ab05bd7213b90d9b099")
      .expect(404);
    expect(missing.body.code).toBe("DOCUMENT_TYPE_NOT_FOUND");
  });

  it("returns a bodyless cache hit for an unchanged representation", async () => {
    const first = await supertest(PlatformTest.callback())
      .get(`/api/v1/document-types/${activeId}`)
      .expect(200);
    const cached = await supertest(PlatformTest.callback())
      .get(`/api/v1/document-types/${activeId}`)
      .set("If-None-Match", first.headers.etag!)
      .expect(304);
    expect(cached.text).toBe("");
  });

  it("publishes rate-limit, sanitized internal, and dependency failures", async () => {
    const {loadGetDocumentTypeSliceFromExpected} = await import("../helpers/openapi-slice.js");
    expect(
      Object.keys(loadGetDocumentTypeSliceFromExpected().operation.responses as object)
    ).toEqual(expect.arrayContaining(["429", "500", "503"]));
  });
});

function row(id: string, name: string, code: string, deletedAt: Date | null, now: Date) {
  return {
    _id: new ObjectId(id),
    name,
    nameNormalized: name.toLowerCase(),
    code,
    description: null,
    deletedAt,
    createdAt: now,
    updatedAt: now
  };
}
