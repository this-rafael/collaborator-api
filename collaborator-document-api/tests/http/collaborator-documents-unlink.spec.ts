import {afterAll, beforeEach, describe, expect, it, vi} from "vitest";
import {MongooseService} from "@tsed/mongoose";
import {ObjectId} from "mongodb";
import supertest from "supertest";
import {PlatformTest} from "@tsed/platform-http/testing";

import {
  linkDeletedFixture,
  linkPendingFixture,
  linkSubmittedFixture,
  linkUnlinkedFixture,
  type CollaboratorDocumentFixture
} from "../helpers/collaborator-document-fixtures.js";
import {resetDatabase} from "../helpers/database.js";
import {bootstrapHttpMongo, httpDatabase} from "../helpers/http-mongo.js";

const pendingId = "66a64ab05bd7213b90d9c001";
const submittedId = "66a64ab05bd7213b90d9c002";
const unlinkedId = "66a64ab05bd7213b90d9c003";
const deletedId = "66a64ab05bd7213b90d9c004";

describe("Unlinking a collaborator document", () => {
  bootstrapHttpMongo({
    beforeBootstrap: () => {
      process.env.RATE_LIMIT_WRITE = "20";
      process.env.RATE_LIMIT_WINDOW_MS = "60000";
    }
  });

  beforeEach(async () => {
    await resetDatabase(httpDatabase());
    await httpDatabase()
      .collection("collaborator_documents")
      .insertMany(
        [
          linkPendingFixture({id: pendingId}),
          linkSubmittedFixture({id: submittedId}),
          linkUnlinkedFixture({id: unlinkedId}),
          linkDeletedFixture({id: deletedId})
        ].map(toMongoRow)
      );
  });

  afterAll(() => {
    delete process.env.RATE_LIMIT_WRITE;
    delete process.env.RATE_LIMIT_WINDOW_MS;
  });

  it("unlinks PENDING without changing status, version, or history", async () => {
    const before = await read(pendingId);
    const response = await unlink(pendingId).expect(204);
    const after = await read(pendingId);

    expect(response.text).toBe("");
    expect(after).toMatchObject({
      status: before?.status,
      currentVersion: before?.currentVersion,
      versions: before?.versions,
      deletedAt: null
    });
    expect(after?.unlinkedAt).toBeInstanceOf(Date);
    expect(after?.updatedAt).not.toEqual(before?.updatedAt);
  });

  it("unlinks SUBMITTED while preserving versions and excluding it from active queries", async () => {
    const before = await read(submittedId);
    await unlink(submittedId).expect(204);
    const after = await read(submittedId);

    expect(after?.status).toBe(before?.status);
    expect(after?.currentVersion).toBe(before?.currentVersion);
    expect(after?.versions).toEqual(before?.versions);
    expect(after?.unlinkedAt).toBeInstanceOf(Date);
    expect(
      await httpDatabase()
        .collection("collaborator_documents")
        .countDocuments({
          _id: new ObjectId(submittedId),
          unlinkedAt: null,
          deletedAt: null
        })
    ).toBe(0);
  });

  it("returns 410 on a repeated unlink without changing timestamps or history", async () => {
    await unlink(pendingId).expect(204);
    const before = await read(pendingId);
    const response = await unlink(pendingId).expect(410);
    const after = await read(pendingId);

    expectProblem(response, "COLLABORATOR_DOCUMENT_UNLINKED");
    expect(after).toEqual(before);
  });

  it("rejects a malformed ObjectId with field-level Problem Details", async () => {
    const response = await unlink("not-an-object-id").expect(400);

    expectProblem(response, "INVALID_OBJECT_ID", "id");
  });

  it("returns a typed 404 without a partial mutation for an unknown id", async () => {
    const response = await unlink("66a64ab05bd7213b90d9b099").expect(404);

    expectProblem(response, "COLLABORATOR_DOCUMENT_NOT_FOUND");
  });

  it("returns 410 for a cascaded deleted link without changing it", async () => {
    const before = await read(deletedId);
    const response = await unlink(deletedId).expect(410);
    const after = await read(deletedId);

    expectProblem(response, "COLLABORATOR_DOCUMENT_DELETED");
    expect(after).toEqual(before);
  });

  it("sanitizes unexpected persistence failures as 500", async () => {
    const getSpy = vi.spyOn(MongooseService.prototype, "get").mockImplementation(() => {
      throw new Error("database internals must not leak");
    });
    try {
      const response = await unlink(pendingId).expect(500);
      expectProblem(response, "INTERNAL_SERVER_ERROR");
      expect(JSON.stringify(response.body)).not.toMatch(/database internals|stack|node_modules/);
    } finally {
      getSpy.mockRestore();
    }
  });

  it("sanitizes unavailable persistence as 503", async () => {
    const getSpy = vi.spyOn(MongooseService.prototype, "get").mockReturnValue(undefined);
    try {
      const response = await unlink(pendingId).expect(503);
      expectProblem(response, "SERVICE_UNAVAILABLE");
      expect(response.body.traceId).toEqual(expect.any(String));
    } finally {
      getSpy.mockRestore();
    }
  });

  it("returns 429 with Retry-After after the DELETE limit is exceeded", async () => {
    const ip = "198.51.100.21";
    for (let attempt = 0; attempt < 20; attempt += 1) await unlink(pendingId, ip);

    const response = await unlink(pendingId, ip).expect(429);
    expectProblem(response, "RATE_LIMIT_EXCEEDED");
    expect(Number.parseInt(response.headers["retry-after"] as string, 10)).toBeGreaterThanOrEqual(
      1
    );
  });
});

function unlink(id: string, ip?: string) {
  const request = supertest(PlatformTest.callback()).delete(`/api/v1/collaborator-documents/${id}`);
  return ip ? request.set("X-Forwarded-For", ip) : request;
}

async function read(id: string) {
  return httpDatabase()
    .collection("collaborator_documents")
    .findOne({_id: new ObjectId(id)});
}

function toMongoRow(fixture: CollaboratorDocumentFixture) {
  return {
    _id: new ObjectId(fixture.id),
    collaboratorId: fixture.collaboratorId,
    documentTypeId: fixture.documentTypeId,
    status: fixture.status,
    currentVersion: fixture.currentVersion,
    versions: fixture.versions,
    lastSubmittedAt: toDate(fixture.lastSubmittedAt),
    linkedAt: new Date(fixture.linkedAt),
    unlinkedAt: toDate(fixture.unlinkedAt),
    createdAt: new Date(fixture.createdAt),
    updatedAt: new Date(fixture.updatedAt),
    deletedAt: toDate(fixture.deletedAt)
  };
}

function toDate(value: string | null): Date | null {
  return value === null ? null : new Date(value);
}

function expectProblem(
  response: {headers: Record<string, string>; body: Record<string, unknown>},
  code: string,
  field?: string
): void {
  expect(response.headers["content-type"]).toContain("application/problem+json");
  expect(response.body).toMatchObject({code, status: response.body.status});
  expect(response.body.traceId).toEqual(expect.any(String));
  if (field)
    expect(response.body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({field})])
    );
}
