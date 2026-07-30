import {beforeEach, describe, expect, it} from "vitest";
import {ObjectId} from "mongodb";
import supertest from "supertest";
import {PlatformTest} from "@tsed/platform-http/testing";

import {
  invalidDocumentTypeBodies,
  validDocumentTypeBody
} from "../helpers/document-type-fixtures.js";
import {resetDatabase} from "../helpers/database.js";
import {bootstrapHttpMongo, httpDatabase} from "../helpers/http-mongo.js";

describe("Creating document types", () => {
  bootstrapHttpMongo();
  beforeEach(async () => resetDatabase(httpDatabase()));

  it("creates an active document type with HAL headers and mutation links", async () => {
    const response = await supertest(PlatformTest.callback())
      .post("/api/v1/document-types")
      .send(validDocumentTypeBody())
      .expect(201);

    expect(response.headers["content-type"]).toContain("application/hal+json");
    expect(response.headers.location).toMatch(/^\/api\/v1\/document-types\/[a-f0-9]{24}$/);
    expect(response.headers.etag).toMatch(/^W\/"sha256:[a-f0-9]{64}"$/);
    expect(response.body).toMatchObject({
      id: expect.stringMatching(/^[a-f0-9]{24}$/),
      code: "ASO",
      deletedAt: null,
      _links: {
        self: {href: response.headers.location},
        collection: {href: "/api/v1/document-types"},
        update: {method: "PATCH"},
        delete: {method: "DELETE"}
      }
    });
    expect(response.body.createdAt).toBeDefined();
    expect(response.body.updatedAt).toBeDefined();
  });

  it.each([
    ["an omitted description", {name: "Carteira de Trabalho", code: "CTPS"}, null],
    ["a null description", validDocumentTypeBody({code: "ASO_NULL", description: null}), null]
  ])("creates a document type with %s", async (_case, body, expected) => {
    const response = await supertest(PlatformTest.callback())
      .post("/api/v1/document-types")
      .send(body)
      .expect(201);
    expect(response.body.description).toBe(expected);
  });

  it("reuses a code held only by deleted document types without altering history", async () => {
    const deletedAt = new Date("2026-07-30T13:00:00.000Z");
    const historicalId = new ObjectId("66a64ab05bd7213b90d9b011");
    await httpDatabase().collection("document_types").insertOne({
      _id: historicalId,
      name: "ASO histórico",
      nameNormalized: "aso historico",
      code: "ASO",
      description: null,
      createdAt: deletedAt,
      updatedAt: deletedAt,
      deletedAt
    });

    await supertest(PlatformTest.callback())
      .post("/api/v1/document-types")
      .send(validDocumentTypeBody())
      .expect(201);
    expect(
      (await httpDatabase().collection("document_types").findOne({_id: historicalId}))?.deletedAt
    ).toEqual(deletedAt);
  });

  it.each([
    ["missing name", invalidDocumentTypeBodies.missingName, "name"],
    ["missing code", invalidDocumentTypeBodies.missingCode, "code"],
    ["empty name", invalidDocumentTypeBodies.emptyName, "name"],
    ["long name", invalidDocumentTypeBodies.longName, "name"],
    ["non-text name", invalidDocumentTypeBodies.nonTextName, "name"],
    ["one-character code", invalidDocumentTypeBodies.shortCode, "code"],
    ["long code", invalidDocumentTypeBodies.longCode, "code"],
    ["numeric initial code", invalidDocumentTypeBodies.numericInitialCode, "code"],
    ["lowercase code", invalidDocumentTypeBodies.lowercaseCode, "code"],
    ["spaced code", invalidDocumentTypeBodies.spacedCode, "code"],
    ["hyphenated code", invalidDocumentTypeBodies.hyphenatedCode, "code"],
    ["non-text code", invalidDocumentTypeBodies.nonTextCode, "code"],
    ["long description", invalidDocumentTypeBodies.longDescription, "description"],
    ["non-text description", invalidDocumentTypeBodies.nonTextDescription, "description"],
    ["an additional property", invalidDocumentTypeBodies.extraProperty, "unexpected"]
  ])("rejects %s with field-level validation", async (_case, body, field) => {
    const response = await supertest(PlatformTest.callback())
      .post("/api/v1/document-types")
      .send(body)
      .expect(422);
    expect(response.body.code).toBe("VALIDATION_ERROR");
    expect(response.body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({field})])
    );
  });

  it.each([
    validDocumentTypeBody({code: "AB", description: "a".repeat(1000)}),
    validDocumentTypeBody({code: `A${"B".repeat(63)}`, description: null})
  ])("accepts valid code and description boundaries", async (body) => {
    await supertest(PlatformTest.callback()).post("/api/v1/document-types").send(body).expect(201);
  });

  it("maps malformed JSON and unsupported media types to published problems", async () => {
    const malformed = await supertest(PlatformTest.callback())
      .post("/api/v1/document-types")
      .set("Content-Type", "application/json")
      .send('{"name":')
      .expect(400);
    expectProblem(malformed, "MALFORMED_JSON");

    const unsupported = await supertest(PlatformTest.callback())
      .post("/api/v1/document-types")
      .set("Content-Type", "text/plain")
      .send("name=ASO")
      .expect(415);
    expectProblem(unsupported, "UNSUPPORTED_MEDIA_TYPE");
  });

  it("maps an active code collision to the stable conflict problem", async () => {
    await supertest(PlatformTest.callback())
      .post("/api/v1/document-types")
      .send(validDocumentTypeBody())
      .expect(201);
    const duplicate = await supertest(PlatformTest.callback())
      .post("/api/v1/document-types")
      .send(validDocumentTypeBody())
      .expect(409);
    expectProblem(duplicate, "DUPLICATE_ACTIVE_DOCUMENT_TYPE_CODE");
    expect(duplicate.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({field: "code", code: "DUPLICATE_ACTIVE_DOCUMENT_TYPE_CODE"})
      ])
    );
  });

  it("publishes rate-limit, sanitized internal, and dependency failures", async () => {
    const expected = await import("../helpers/openapi-slice.js");
    const responses = expected.loadCreateDocumentTypeSliceFromExpected().operation.responses;
    expect(Object.keys(responses as object)).toEqual(expect.arrayContaining(["429", "500", "503"]));
  });
});

function expectProblem(
  response: {status: number; headers: Record<string, unknown>; body: Record<string, unknown>},
  code: string
) {
  expect(response.headers["content-type"]).toContain("application/problem+json");
  expect(response.body).toMatchObject({code, status: response.status});
  expect(response.body).not.toHaveProperty("stack");
}
