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
import {CollaboratorDocumentsRuntime} from "../../src/modules/collaborator-documents/collaborator-documents.runtime.js";

const pendingId = "66a64ab05bd7213b90d9c001";
const submittedId = "66a64ab05bd7213b90d9c002";
const unlinkedId = "66a64ab05bd7213b90d9c003";
const deletedId = "66a64ab05bd7213b90d9c004";

describe("Getting a collaborator document", () => {
  bootstrapHttpMongo({
    beforeBootstrap: () => {
      process.env.RATE_LIMIT_GET = "60";
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
          linkSubmittedFixture({
            id: submittedId,
            documentTypeId: "66a64ab05bd7213b90d9b011"
          }),
          linkUnlinkedFixture({id: unlinkedId}),
          linkDeletedFixture({id: deletedId, documentTypeId: "66a64ab05bd7213b90d9b012"})
        ].map(toMongoRow)
      );
    PlatformTest.get<CollaboratorDocumentsRuntime>(
      CollaboratorDocumentsRuntime
    ).resetRateLimiters();
  });

  afterAll(() => {
    delete process.env.RATE_LIMIT_GET;
    delete process.env.RATE_LIMIT_WINDOW_MS;
  });

  it("returns active PENDING HAL with submit and unlink actions", async () => {
    const response = await get(pendingId).expect(200);

    expect(response.headers["content-type"]).toContain("application/hal+json");
    expect(response.body).toMatchObject({
      id: pendingId,
      status: "PENDING",
      currentVersion: 0,
      lastSubmittedAt: null,
      unlinkedAt: null,
      deletedAt: null
    });
    expect(response.body._links["submit-version"]).toBeDefined();
    expect(response.body._links.unlink).toBeDefined();
    expect(response.body._links["current-version"]).toBeUndefined();
    expect(response.headers.etag).toMatch(/^W\/"sha256:[a-f0-9]{64}"$/);
  });

  it("returns active SUBMITTED HAL with current, resubmit, and unlink actions", async () => {
    const response = await get(submittedId).expect(200);

    expect(response.body.status).toBe("SUBMITTED");
    expect(response.body.currentVersion).toBeGreaterThanOrEqual(1);
    expect(response.body.lastSubmittedAt).not.toBeNull();
    expect(response.body._links["current-version"]).toBeDefined();
    expect(response.body._links["resubmit-version"]).toBeDefined();
    expect(response.body._links.unlink).toBeDefined();
  });

  it("returns an unlinked historical record without write actions", async () => {
    const response = await get(unlinkedId).expect(200);

    expect(response.body.unlinkedAt).not.toBeNull();
    expect(response.body._links["submit-version"]).toBeUndefined();
    expect(response.body._links["current-version"]).toBeUndefined();
    expect(response.body._links["resubmit-version"]).toBeUndefined();
    expect(response.body._links.unlink).toBeUndefined();
    expect(response.body._links.versions).toBeDefined();
  });

  it("returns a cascaded deleted historical record without write actions", async () => {
    const response = await get(deletedId).expect(200);

    expect(response.body.deletedAt).not.toBeNull();
    expect(response.body._links["submit-version"]).toBeUndefined();
    expect(response.body._links["current-version"]).toBeUndefined();
    expect(response.body._links["resubmit-version"]).toBeUndefined();
    expect(response.body._links.unlink).toBeUndefined();
  });

  it("rejects a malformed ObjectId with field-level Problem Details", async () => {
    const response = await get("not-an-object-id").expect(400);

    expectProblem(response, "INVALID_OBJECT_ID", "id");
  });

  it("returns 304 without a body when If-None-Match matches", async () => {
    const first = await get(pendingId).expect(200);
    const second = await get(pendingId)
      .set("If-None-Match", first.headers.etag as string)
      .expect(304);

    expect(second.text).toBe("");
    expect(second.body).toEqual({});
  });

  it("returns a typed 404 for a valid but unknown identifier", async () => {
    const response = await get("66a64ab05bd7213b90d9b099").expect(404);

    expectProblem(response, "COLLABORATOR_DOCUMENT_NOT_FOUND");
  });

  it("sanitizes unexpected persistence failures as 500", async () => {
    const getSpy = vi.spyOn(MongooseService.prototype, "get").mockImplementation(() => {
      throw new Error("database internals must not leak");
    });
    try {
      const response = await get(pendingId).expect(500);
      expectProblem(response, "INTERNAL_SERVER_ERROR");
      expect(JSON.stringify(response.body)).not.toMatch(/database internals|stack|node_modules/);
    } finally {
      getSpy.mockRestore();
    }
  });

  it("sanitizes unavailable persistence as 503", async () => {
    const getSpy = vi.spyOn(MongooseService.prototype, "get").mockReturnValue(undefined);
    try {
      const response = await get(pendingId).expect(503);
      expectProblem(response, "SERVICE_UNAVAILABLE");
      expect(response.body.traceId).toEqual(expect.any(String));
    } finally {
      getSpy.mockRestore();
    }
  });

  it("returns 429 with Retry-After after the GET limit is exceeded", async () => {
    const ip = "198.51.100.20";
    for (let attempt = 0; attempt < 60; attempt += 1) await get(pendingId, ip).expect(200);

    const response = await get(pendingId, ip).expect(429);
    expectProblem(response, "RATE_LIMIT_EXCEEDED");
    expect(Number.parseInt(response.headers["retry-after"] as string, 10)).toBeGreaterThanOrEqual(
      1
    );
  });
});

function get(id: string, ip?: string) {
  const request = supertest(PlatformTest.callback()).get(`/api/v1/collaborator-documents/${id}`);
  return ip ? request.set("X-Forwarded-For", ip) : request;
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
