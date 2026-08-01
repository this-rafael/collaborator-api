import {afterAll, beforeEach, describe, expect, it, vi} from "vitest";
import {MongooseService} from "@tsed/mongoose";
import {ObjectId} from "mongodb";
import supertest from "supertest";
import {PlatformTest} from "@tsed/platform-http/testing";

import {cursorClock, cursorSecret} from "../helpers/cursor-runtime.js";
import {
  documentVersionHistoryFixtures,
  linkDeletedFixture,
  linkPendingFixture,
  linkSubmittedFixture,
  linkUnlinkedFixture,
  type CollaboratorDocumentFixture,
  type DocumentVersionFixture
} from "../helpers/collaborator-document-fixtures.js";
import {resetDatabase} from "../helpers/database.js";
import {bootstrapHttpMongo, httpDatabase} from "../helpers/http-mongo.js";
import {CollaboratorDocumentsRuntime} from "../../src/modules/collaborator-documents/collaborator-documents.runtime.js";

const historyId = "66a64ab05bd7213b90d9d101";
const pendingId = "66a64ab05bd7213b90d9d102";
const unlinkedId = "66a64ab05bd7213b90d9d103";
const deletedId = "66a64ab05bd7213b90d9d104";
const otherHistoryId = "66a64ab05bd7213b90d9d105";
const unknownId = "66a64ab05bd7213b90d9d199";

describe("Listing collaborator document versions", () => {
  bootstrapHttpMongo({
    beforeBootstrap: () => {
      process.env.RATE_LIMIT_GET = "100";
      process.env.RATE_LIMIT_WINDOW_MS = "60000";
    }
  });

  beforeEach(async () => {
    await resetDatabase(httpDatabase());
    await seedBaseDocuments();
    PlatformTest.get<CollaboratorDocumentsRuntime>(
      CollaboratorDocumentsRuntime
    ).resetRateLimiters();
  });

  afterAll(() => {
    delete process.env.RATE_LIMIT_GET;
    delete process.env.RATE_LIMIT_WINDOW_MS;
  });

  // VER-LIST-001
  it("returns versions in descending order by default", async () => {
    const response = await list().expect(200);

    expect(response.headers["content-type"]).toContain("application/hal+json");
    expect(response.headers.etag).toMatch(/^W\/"sha256:[a-f0-9]{64}"$/);
    expect(versionItems(response.body).map((item) => item.version)).toEqual([3, 2, 1]);
    expect(response.body.currentVersion).toBe(3);
  });

  // VER-LIST-002
  it("returns versions in ascending order when requested", async () => {
    const response = await list({order: "asc"}).expect(200);

    expect(response.headers["content-type"]).toContain("application/hal+json");
    expect(versionItems(response.body).map((item) => item.version)).toEqual([1, 2, 3]);
  });

  // VER-LIST-003
  it("returns an empty history for a pending document", async () => {
    const response = await list({}, pendingId).expect(200);

    expect(response.headers["content-type"]).toContain("application/hal+json");
    expect(response.body).toMatchObject({count: 0, currentVersion: 0});
    expect(versionItems(response.body)).toEqual([]);
  });

  // VER-LIST-004
  it.each([
    ["unlinked", unlinkedId],
    ["deleted", deletedId]
  ])("keeps the version history readable for a %s document", async (_lifecycle, id) => {
    const response = await list({}, id).expect(200);

    expect(response.headers["content-type"]).toContain("application/hal+json");
    expect(versionItems(response.body).map((item) => item.version)).toEqual([3, 2, 1]);
    expect(response.body.currentVersion).toBe(3);
  });

  // VER-LIST-005
  it("rejects an unsupported ordering value", async () => {
    const response = await list({order: "sideways"}).expect(400);
    expectProblem(response, "INVALID_QUERY_PARAMETER", "order");
  });

  // VER-LIST-006
  it("rejects a malformed document identifier", async () => {
    const response = await list({}, "not-an-object-id").expect(400);
    expectProblem(response, "INVALID_OBJECT_ID", "id");
  });

  // VER-LIST-007
  it("uses a default page size of twenty and publishes a self link", async () => {
    await resetDatabase(httpDatabase());
    await seedDocuments([historyDocument(historyId, 25)]);
    const response = await list().expect(200);

    expect(response.headers["content-type"]).toContain("application/hal+json");
    expect(versionItems(response.body)).toHaveLength(20);
    expect(response.body._links.self.href).toEqual(expect.any(String));
  });

  // VER-LIST-008
  it.each([1, 100])("honors the pagination boundary limit=%s", async (limit) => {
    await resetDatabase(httpDatabase());
    await seedDocuments([historyDocument(historyId, 101)]);
    const response = await list({limit}).expect(200);

    expect(response.headers["content-type"]).toContain("application/hal+json");
    expect(versionItems(response.body)).toHaveLength(limit);
  });

  // VER-LIST-009
  it("continues with the opaque next cursor without repeats or omissions", async () => {
    const first = await list({limit: 1}).expect(200);
    const nextHref = first.body._links.next.href as string;
    const second = await supertest(PlatformTest.callback()).get(nextHref).expect(200);

    expect(versionItems(first.body).map((item) => item.version)).toEqual([3]);
    expect(versionItems(second.body).map((item) => item.version)).toEqual([2]);
    expect(new URL(nextHref, "http://localhost").searchParams.get("cursor")).toEqual(
      expect.any(String)
    );
  });

  // VER-LIST-010
  it("rejects an empty cursor", async () => {
    const response = await list({cursor: ""}).expect(400);
    expectProblem(response, "INVALID_QUERY_PARAMETER", "cursor");
  });

  // VER-LIST-011
  it("rejects a page limit below one", async () => {
    const response = await list({limit: 0}).expect(400);
    expectProblem(response, "INVALID_QUERY_PARAMETER", "limit");
  });

  // VER-LIST-012
  it("rejects a page limit above one hundred", async () => {
    const response = await list({limit: 101}).expect(400);
    expectProblem(response, "INVALID_QUERY_PARAMETER", "limit");
  });

  // VER-LIST-013
  it("rejects a non-integer page limit", async () => {
    const response = await list({limit: "not-an-integer"}).expect(400);
    expectProblem(response, "INVALID_QUERY_PARAMETER", "limit");
  });

  // VER-LIST-014
  it("returns no body when the current entity tag is revalidated", async () => {
    const first = await list().expect(200);
    const second = await list()
      .set("If-None-Match", first.headers.etag as string)
      .expect(304);

    expect(second.text).toBe("");
    expect(second.body).toEqual({});
  });

  // VER-LIST-015
  it("returns not found for an unknown document", async () => {
    const response = await list({}, unknownId).expect(404);
    expectProblem(response, "COLLABORATOR_DOCUMENT_NOT_FOUND");
  });

  // VER-LIST-016
  it("returns a retry delay after the read operation limit is exceeded", async () => {
    const ip = "198.51.100.23";
    for (let attempt = 0; attempt < 100; attempt += 1) {
      await list({}, historyId, ip);
    }
    const response = await list({}, historyId, ip).expect(429);

    expectProblem(response, "RATE_LIMIT_EXCEEDED");
    expect(Number.parseInt(response.headers["retry-after"] as string, 10)).toBeGreaterThanOrEqual(
      1
    );
  });

  // VER-LIST-017
  it("sanitizes an unexpected persistence failure", async () => {
    const getSpy = vi.spyOn(MongooseService.prototype, "get").mockImplementation(() => {
      throw new Error("database internals must not leak");
    });
    try {
      const response = await list().expect(500);
      expectProblem(response, "INTERNAL_SERVER_ERROR");
      expect(JSON.stringify(response.body)).not.toMatch(/database internals|stack|node_modules/);
    } finally {
      getSpy.mockRestore();
    }
  });

  // VER-LIST-018
  it("returns a sanitized unavailable response when persistence is down", async () => {
    const getSpy = vi.spyOn(MongooseService.prototype, "get").mockReturnValue(undefined);
    try {
      const response = await list().expect(503);
      expectProblem(response, "SERVICE_UNAVAILABLE");
    } finally {
      getSpy.mockRestore();
    }
  });

  // VER-LIST-019
  it("rejects tampered, expired, and context-incompatible cursors without a partial page", async () => {
    const first = await list({limit: 1}).expect(200);
    const nextUrl = new URL(first.body._links.next.href as string, "http://localhost");
    const validCursor = nextUrl.searchParams.get("cursor");
    expect(validCursor).toEqual(expect.any(String));

    const cursorModule =
      await import("../../src/shared/infrastructure/security/hmac-cursor-codec.js");
    const expired = new cursorModule.HmacCursorCodec(cursorSecret, cursorClock()).encode({
      operationId: "listDocumentVersions",
      filtersHash: "expired",
      order: "version:desc",
      limit: 1,
      position: {id: "3"}
    });

    const responses = await Promise.all([
      list({cursor: `${validCursor}tampered`, limit: 1}).expect(400),
      list({cursor: expired, limit: 1}).expect(400),
      list({cursor: validCursor as string, limit: 1, order: "asc"}).expect(400),
      list({cursor: validCursor as string, limit: 2}).expect(400),
      list({cursor: validCursor as string, limit: 1}, otherHistoryId).expect(400)
    ]);

    for (const response of responses) {
      expectProblem(response, "INVALID_QUERY_PARAMETER", "cursor");
      expect(response.body._embedded).toBeUndefined();
    }
  });
});

function list(query: Record<string, string | number> = {}, id = historyId, ip?: string) {
  const request = supertest(PlatformTest.callback())
    .get(`/api/v1/collaborator-documents/${id}/versions`)
    .query(query);
  return ip ? request.set("X-Forwarded-For", ip) : request;
}

type VersionItem = {version: number};

function versionItems(body: Record<string, unknown>): VersionItem[] {
  const embedded = body._embedded;
  if (!embedded || typeof embedded !== "object" || Array.isArray(embedded)) return [];
  const versions = (embedded as Record<string, unknown>).versions;
  return Array.isArray(versions) ? (versions as VersionItem[]) : [];
}

function expectProblem(
  response: {
    status: number;
    headers: Record<string, string>;
    body: Record<string, unknown>;
  },
  code: string,
  field?: string
): void {
  expect(response.headers["content-type"]).toContain("application/problem+json");
  expect(response.body).toMatchObject({code, status: response.status});
  for (const key of ["type", "title", "status", "detail", "instance", "traceId"]) {
    expect(response.body[key]).toBeDefined();
  }
  if (field) {
    expect(response.body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({field})])
    );
  }
}

async function seedBaseDocuments(): Promise<void> {
  await seedDocuments([
    historyDocument(historyId, 3),
    linkPendingFixture({id: pendingId, documentTypeId: pendingId}),
    historyDocument(unlinkedId, 3, {unlinkedAt: "2026-07-30T15:00:00.000Z"}),
    historyDocument(deletedId, 3, {deletedAt: "2026-07-30T16:00:00.000Z"}),
    historyDocument(otherHistoryId, 3)
  ]);
}

function historyDocument(
  id: string,
  count: number,
  lifecycle: Partial<Pick<CollaboratorDocumentFixture, "unlinkedAt" | "deletedAt">> = {}
): CollaboratorDocumentFixture {
  const versions = documentVersionHistoryFixtures(count);
  const overrides = {
    id,
    documentTypeId: id,
    status: "SUBMITTED" as const,
    currentVersion: count,
    versions,
    lastSubmittedAt: versions.at(-1)?.submittedAt ?? null,
    versionCount: count,
    ...lifecycle
  };
  if (lifecycle.deletedAt) return linkDeletedFixture(overrides);
  if (lifecycle.unlinkedAt) return linkUnlinkedFixture(overrides);
  return linkSubmittedFixture(overrides);
}

async function seedDocuments(fixtures: CollaboratorDocumentFixture[]): Promise<void> {
  if (fixtures.length > 0) {
    await httpDatabase().collection("collaborator_documents").insertMany(fixtures.map(toMongoRow));
  }
}

function toMongoRow(fixture: CollaboratorDocumentFixture) {
  return {
    _id: new ObjectId(fixture.id),
    collaboratorId: fixture.collaboratorId,
    documentTypeId: fixture.documentTypeId,
    status: fixture.status,
    currentVersion: fixture.currentVersion,
    versions: fixture.versions.map(toMongoVersion),
    lastSubmittedAt: toDate(fixture.lastSubmittedAt),
    linkedAt: new Date(fixture.linkedAt),
    unlinkedAt: toDate(fixture.unlinkedAt),
    createdAt: new Date(fixture.createdAt),
    updatedAt: new Date(fixture.updatedAt),
    deletedAt: toDate(fixture.deletedAt)
  };
}

function toMongoVersion(version: unknown): unknown {
  if (!version || typeof version !== "object" || Array.isArray(version)) return version;
  const candidate = version as Partial<DocumentVersionFixture>;
  return candidate.submittedAt
    ? {...candidate, submittedAt: new Date(candidate.submittedAt)}
    : version;
}

function toDate(value: string | null): Date | null {
  return value === null ? null : new Date(value);
}
