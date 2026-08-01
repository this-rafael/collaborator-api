import {afterAll, beforeEach, describe, expect, it, vi} from "vitest";
import {MongooseService} from "@tsed/mongoose";
import {ObjectId} from "mongodb";
import supertest from "supertest";
import {PlatformTest} from "@tsed/platform-http/testing";

import {
  documentVersionHistoryFixtures,
  linkDeletedFixture,
  linkSubmittedFixture,
  linkUnlinkedFixture,
  type CollaboratorDocumentFixture,
  type DocumentVersionFixture
} from "../helpers/collaborator-document-fixtures.js";
import {resetDatabase} from "../helpers/database.js";
import {bootstrapHttpMongo, httpDatabase} from "../helpers/http-mongo.js";
import {CollaboratorDocumentsRuntime} from "../../src/modules/collaborator-documents/collaborator-documents.runtime.js";

const activeId = "66a64ab05bd7213b90d9d201";
const unlinkedId = "66a64ab05bd7213b90d9d202";
const deletedId = "66a64ab05bd7213b90d9d203";
const unknownId = "66a64ab05bd7213b90d9d299";

describe("Getting a collaborator document version", () => {
  bootstrapHttpMongo({
    beforeBootstrap: () => {
      process.env.RATE_LIMIT_GET = "100";
      process.env.RATE_LIMIT_WINDOW_MS = "60000";
    }
  });

  beforeEach(async () => {
    await resetDatabase(httpDatabase());
    await seedDocuments();
    PlatformTest.get<CollaboratorDocumentsRuntime>(
      CollaboratorDocumentsRuntime
    ).resetRateLimiters();
  });

  afterAll(() => {
    delete process.env.RATE_LIMIT_GET;
    delete process.env.RATE_LIMIT_WINDOW_MS;
  });

  // VER-GET-001
  it("returns an existing version with its document navigation and entity tag", async () => {
    const response = await getVersion(activeId, 2).expect(200);

    expect(response.headers["content-type"]).toContain("application/hal+json");
    expect(response.headers.etag).toMatch(/^W\/"sha256:[a-f0-9]{64}"$/);
    expect(response.body).toMatchObject({
      version: 2,
      submittedAt: "2026-07-30T12:31:00.000Z",
      metadata: {
        originalName: "document-2.pdf",
        mimeType: "application/pdf",
        sizeBytes: 248_193,
        storageKey: "collaborators/66a64ab05bd7213b90d9b001/documents/v2.pdf",
        notes: "Document version 2"
      },
      _links: {
        self: {href: `/api/v1/collaborator-documents/${activeId}/versions/2`},
        document: {href: `/api/v1/collaborator-documents/${activeId}`},
        previous: {href: `/api/v1/collaborator-documents/${activeId}/versions/1`}
      }
    });
    expect(response.body.versions).toBeUndefined();
    expect(response.body._embedded).toBeUndefined();
  });

  // VER-GET-002
  it.each([
    ["unlinked", unlinkedId],
    ["deleted", deletedId]
  ])("keeps a version readable without write links for a %s document", async (_state, id) => {
    const response = await getVersion(id, 2).expect(200);

    expect(response.headers["content-type"]).toContain("application/hal+json");
    expect(response.body.version).toBe(2);
    const links = Object.values(response.body._links as Record<string, {method?: string}>);
    expect(links.some((link) => ["POST", "PATCH", "DELETE"].includes(link.method ?? ""))).toBe(
      false
    );
  });

  // VER-GET-003
  it("rejects version zero", async () => {
    const response = await getVersion(activeId, 0).expect(400);
    expectProblem(response, "INVALID_VERSION_NUMBER", "version");
  });

  // VER-GET-004
  it("rejects a negative version", async () => {
    const response = await getVersion(activeId, -1).expect(400);
    expectProblem(response, "INVALID_VERSION_NUMBER", "version");
  });

  // VER-GET-005
  it("rejects a non-integer version", async () => {
    const response = await getVersion(activeId, 1.5).expect(400);
    expectProblem(response, "INVALID_VERSION_NUMBER", "version");
  });

  // VER-GET-006
  it("rejects a malformed document identifier", async () => {
    const response = await getVersion("not-an-object-id", 2).expect(400);
    expectProblem(response, "INVALID_OBJECT_ID", "id");
  });

  // VER-GET-007
  it("returns no body when the current entity tag is revalidated", async () => {
    const first = await getVersion(activeId, 2).expect(200);
    const second = await getVersion(activeId, 2)
      .set("If-None-Match", first.headers.etag as string)
      .expect(304);

    expect(second.text).toBe("");
    expect(second.body).toEqual({});
  });

  // VER-GET-008
  it("returns not found for an unknown document", async () => {
    const response = await getVersion(unknownId, 2).expect(404);
    expectProblem(response, "COLLABORATOR_DOCUMENT_NOT_FOUND");
  });

  // VER-GET-009
  it("returns not found when the requested version is absent from the document", async () => {
    const response = await getVersion(activeId, 4).expect(404);
    expectProblem(response, "DOCUMENT_VERSION_NOT_FOUND");
  });

  // VER-GET-010
  it("returns a retry delay after the read operation limit is exceeded", async () => {
    const ip = "198.51.100.24";
    for (let attempt = 0; attempt < 100; attempt += 1) {
      await getVersion(activeId, 2, ip);
    }
    const response = await getVersion(activeId, 2, ip).expect(429);

    expectProblem(response, "RATE_LIMIT_EXCEEDED");
    expect(Number.parseInt(response.headers["retry-after"] as string, 10)).toBeGreaterThanOrEqual(
      1
    );
  });

  // VER-GET-011
  it("sanitizes an unexpected persistence failure", async () => {
    const getSpy = vi.spyOn(MongooseService.prototype, "get").mockImplementation(() => {
      throw new Error("database internals must not leak");
    });
    try {
      const response = await getVersion(activeId, 2).expect(500);
      expectProblem(response, "INTERNAL_SERVER_ERROR");
      expect(JSON.stringify(response.body)).not.toMatch(/database internals|stack|node_modules/);
    } finally {
      getSpy.mockRestore();
    }
  });

  // VER-GET-012
  it("returns a sanitized unavailable response when persistence is down", async () => {
    const getSpy = vi.spyOn(MongooseService.prototype, "get").mockReturnValue(undefined);
    try {
      const response = await getVersion(activeId, 2).expect(503);
      expectProblem(response, "SERVICE_UNAVAILABLE");
    } finally {
      getSpy.mockRestore();
    }
  });
});

function getVersion(id: string, version: number, ip?: string) {
  const request = supertest(PlatformTest.callback()).get(
    `/api/v1/collaborator-documents/${id}/versions/${version}`
  );
  return ip ? request.set("X-Forwarded-For", ip) : request;
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

async function seedDocuments(): Promise<void> {
  const versions = documentVersionHistoryFixtures(3);
  await httpDatabase()
    .collection("collaborator_documents")
    .insertMany(
      [
        historyDocument(activeId, versions),
        historyDocument(unlinkedId, versions, {unlinkedAt: "2026-07-30T15:00:00.000Z"}),
        historyDocument(deletedId, versions, {deletedAt: "2026-07-30T16:00:00.000Z"})
      ].map(toMongoRow)
    );
}

function historyDocument(
  id: string,
  versions: readonly DocumentVersionFixture[],
  lifecycle: Partial<Pick<CollaboratorDocumentFixture, "unlinkedAt" | "deletedAt">> = {}
): CollaboratorDocumentFixture {
  const overrides = {
    id,
    documentTypeId: id,
    status: "SUBMITTED" as const,
    currentVersion: versions.length,
    versions,
    lastSubmittedAt: versions.at(-1)?.submittedAt ?? null,
    versionCount: versions.length,
    ...lifecycle
  };
  if (lifecycle.deletedAt) return linkDeletedFixture(overrides);
  if (lifecycle.unlinkedAt) return linkUnlinkedFixture(overrides);
  return linkSubmittedFixture(overrides);
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
