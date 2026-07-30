import {beforeEach, describe, expect, it} from "vitest";
import {ObjectId} from "mongodb";
import supertest from "supertest";
import {PlatformTest} from "@tsed/platform-http/testing";

import {resetDatabase} from "../helpers/database.js";
import {bootstrapHttpMongo, httpDatabase} from "../helpers/http-mongo.js";

const activeId = "66a64ab05bd7213b90d9b010";
const deletedId = "66a64ab05bd7213b90d9b011";
const conflictingId = "66a64ab05bd7213b90d9b012";

describe("Updating a document type", () => {
  bootstrapHttpMongo();

  beforeEach(async () => {
    await resetDatabase(httpDatabase());
    const createdAt = new Date("2026-07-30T12:00:00.000Z");
    await httpDatabase()
      .collection("document_types")
      .insertMany([
        row(activeId, "Atestado", "ASO", "Descrição original", null, createdAt),
        row(deletedId, "Histórico", "HISTORICAL", null, createdAt, createdAt),
        row(conflictingId, "Carteira", "CTPS", null, null, createdAt)
      ]);
  });

  it.each([
    [
      {name: "Atestado Ocupacional"},
      {name: "Atestado Ocupacional", code: "ASO", description: "Descrição original"}
    ],
    [{code: "ASO_NEW"}, {name: "Atestado", code: "ASO_NEW", description: "Descrição original"}],
    [
      {description: "Descrição nova"},
      {name: "Atestado", description: "Descrição nova", code: "ASO"}
    ],
    [{description: null}, {name: "Atestado", description: null, code: "ASO"}]
  ])("updates only fields present in a valid partial body", async (patch, expected) => {
    const response = await supertest(PlatformTest.callback())
      .patch(`/api/v1/document-types/${activeId}`)
      .send(patch)
      .expect(200);
    expect(response.body).toMatchObject(expected);
    expect(response.body.createdAt).toBe("2026-07-30T12:00:00.000Z");
    expect(response.body.updatedAt).not.toBe(response.body.createdAt);
    expect(response.headers.etag).toMatch(/^W\/"sha256:[a-f0-9]{64}"$/);
  });

  it("reuses a code held only by a deleted document type", async () => {
    const response = await supertest(PlatformTest.callback())
      .patch(`/api/v1/document-types/${activeId}`)
      .send({code: "HISTORICAL"})
      .expect(200);
    expect(response.body.code).toBe("HISTORICAL");
  });

  it.each([
    ["an empty patch", {}, undefined],
    ["an additional property", {unexpected: true}, "unexpected"],
    ["an empty name", {name: ""}, "name"],
    ["a long name", {name: "a".repeat(201)}, "name"],
    ["a non-text name", {name: 42}, "name"],
    ["a short code", {code: "A"}, "code"],
    ["a long code", {code: `A${"B".repeat(64)}`}, "code"],
    ["a lowercase code", {code: "aso"}, "code"],
    ["a long description", {description: "a".repeat(1001)}, "description"],
    ["a non-text description", {description: false}, "description"]
  ])("rejects %s without changing the stored type", async (_case, patch, field) => {
    const response = await supertest(PlatformTest.callback())
      .patch(`/api/v1/document-types/${activeId}`)
      .send(patch)
      .expect(422);
    expect(response.body.code).toBe("VALIDATION_ERROR");
    if (field)
      expect(response.body.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({field})])
      );
    expect(
      (
        await httpDatabase()
          .collection("document_types")
          .findOne({_id: new ObjectId(activeId)})
      )?.code
    ).toBe("ASO");
  });

  it("maps identifier, media, state, and uniqueness failures", async () => {
    const invalid = await supertest(PlatformTest.callback())
      .patch("/api/v1/document-types/nope")
      .send({name: "Atestado"})
      .expect(400);
    expect(invalid.body.code).toBe("INVALID_OBJECT_ID");

    await supertest(PlatformTest.callback())
      .patch(`/api/v1/document-types/${activeId}`)
      .set("Content-Type", "text/plain")
      .send("name=Atestado")
      .expect(415);

    const missing = await supertest(PlatformTest.callback())
      .patch("/api/v1/document-types/66a64ab05bd7213b90d9b099")
      .send({name: "Atestado"})
      .expect(404);
    expect(missing.body.code).toBe("DOCUMENT_TYPE_NOT_FOUND");

    const duplicate = await supertest(PlatformTest.callback())
      .patch(`/api/v1/document-types/${activeId}`)
      .send({code: "CTPS"})
      .expect(409);
    expect(duplicate.body.code).toBe("DUPLICATE_ACTIVE_DOCUMENT_TYPE_CODE");

    const deleted = await supertest(PlatformTest.callback())
      .patch(`/api/v1/document-types/${deletedId}`)
      .send({name: "Histórico alterado"})
      .expect(410);
    expect(deleted.body.code).toBe("DOCUMENT_TYPE_DELETED");
  });

  it("publishes rate-limit, sanitized internal, and dependency failures", async () => {
    const {loadUpdateDocumentTypeSliceFromExpected} = await import("../helpers/openapi-slice.js");
    expect(
      Object.keys(loadUpdateDocumentTypeSliceFromExpected().operation.responses as object)
    ).toEqual(expect.arrayContaining(["429", "500", "503"]));
  });
});

function row(
  id: string,
  name: string,
  code: string,
  description: string | null,
  deletedAt: Date | null,
  createdAt: Date
) {
  return {
    _id: new ObjectId(id),
    name,
    nameNormalized: name.toLowerCase(),
    code,
    description,
    deletedAt,
    createdAt,
    updatedAt: createdAt
  };
}
