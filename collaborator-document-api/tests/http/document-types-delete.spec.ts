import {beforeEach, describe, expect, it} from "vitest";
import {ObjectId} from "mongodb";
import supertest from "supertest";
import {PlatformTest} from "@tsed/platform-http/testing";

import {resetDatabase} from "../helpers/database.js";
import {bootstrapHttpMongo, httpDatabase} from "../helpers/http-mongo.js";

const documentTypeId = "66a64ab05bd7213b90d9b010";

describe("Deleting a document type", () => {
  bootstrapHttpMongo();

  beforeEach(async () => {
    await resetDatabase(httpDatabase());
    const now = new Date("2026-07-30T12:00:00.000Z");
    await httpDatabase()
      .collection("document_types")
      .insertOne({
        _id: new ObjectId(documentTypeId),
        name: "Atestado",
        nameNormalized: "atestado",
        code: "ASO",
        description: null,
        deletedAt: null,
        createdAt: now,
        updatedAt: now
      });
    await httpDatabase()
      .collection("collaborator_documents")
      .insertMany([
        linkedDocument("66a64ab05bd7213b90d9c001", "PENDING"),
        linkedDocument("66a64ab05bd7213b90d9c002", "SUBMITTED")
      ]);
  });

  it("soft deletes the type and all active linked documents without a body", async () => {
    const response = await supertest(PlatformTest.callback())
      .delete(`/api/v1/document-types/${documentTypeId}`)
      .expect(204);
    expect(response.text).toBe("");

    const deletedType = await httpDatabase()
      .collection("document_types")
      .findOne({_id: new ObjectId(documentTypeId)});
    const links = await httpDatabase()
      .collection("collaborator_documents")
      .find({documentTypeId})
      .toArray();
    expect(deletedType?.deletedAt).toBeInstanceOf(Date);
    expect(links).toHaveLength(2);
    expect(links.every((link) => link.deletedAt instanceof Date)).toBe(true);
    expect(
      links.every((link) => link.deletedAt?.getTime() === deletedType?.deletedAt?.getTime())
    ).toBe(true);
    expect(links.map((link) => link.versions)).toEqual([
      [{version: 1, payload: "preserved"}],
      [{version: 1, payload: "preserved"}]
    ]);
  });

  it("keeps repeated deletion idempotent without overwriting cascade timestamps", async () => {
    await supertest(PlatformTest.callback())
      .delete(`/api/v1/document-types/${documentTypeId}`)
      .expect(204);
    const firstType = await httpDatabase()
      .collection("document_types")
      .findOne({_id: new ObjectId(documentTypeId)});
    const firstLinks = await httpDatabase()
      .collection("collaborator_documents")
      .find({documentTypeId})
      .toArray();

    await supertest(PlatformTest.callback())
      .delete(`/api/v1/document-types/${documentTypeId}`)
      .expect(204);
    const repeatedType = await httpDatabase()
      .collection("document_types")
      .findOne({_id: new ObjectId(documentTypeId)});
    const repeatedLinks = await httpDatabase()
      .collection("collaborator_documents")
      .find({documentTypeId})
      .toArray();
    expect(repeatedType?.deletedAt).toEqual(firstType?.deletedAt);
    expect(repeatedLinks.map(({deletedAt}) => deletedAt)).toEqual(
      firstLinks.map(({deletedAt}) => deletedAt)
    );
  });

  it("rejects malformed and unknown document type identifiers", async () => {
    const invalid = await supertest(PlatformTest.callback())
      .delete("/api/v1/document-types/nope")
      .expect(400);
    expect(invalid.body.code).toBe("INVALID_OBJECT_ID");
    expect(invalid.body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({field: "id"})])
    );

    const missing = await supertest(PlatformTest.callback())
      .delete("/api/v1/document-types/66a64ab05bd7213b90d9b099")
      .expect(404);
    expect(missing.body.code).toBe("DOCUMENT_TYPE_NOT_FOUND");
  });

  it("publishes atomic rollback, rate-limit, internal, and dependency failures", async () => {
    const {loadDeleteDocumentTypeSliceFromExpected} = await import("../helpers/openapi-slice.js");
    expect(
      Object.keys(loadDeleteDocumentTypeSliceFromExpected().operation.responses as object)
    ).toEqual(expect.arrayContaining(["429", "500", "503"]));
  });
});

function linkedDocument(id: string, status: "PENDING" | "SUBMITTED") {
  return {
    _id: new ObjectId(id),
    collaboratorId: "66a64ab05bd7213b90d9b001",
    documentTypeId,
    status,
    deletedAt: null,
    versions: [{version: 1, payload: "preserved"}]
  };
}
