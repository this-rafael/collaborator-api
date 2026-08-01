import {MongooseService} from "@tsed/mongoose";
import {PlatformTest} from "@tsed/platform-http/testing";
import {ObjectId, type Document} from "mongodb";
import supertest from "supertest";
import {afterAll, beforeEach, describe, expect, it, vi} from "vitest";

import {ReportingRuntime} from "../../src/modules/reporting/reporting.runtime.js";
import {cursorClock, cursorSecret} from "../helpers/cursor-runtime.js";
import {resetDatabase} from "../helpers/database.js";
import {bootstrapHttpMongo, httpDatabase} from "../helpers/http-mongo.js";
import {
  submissionEventPageFixtures,
  type SubmissionEventFixture
} from "../helpers/reporting-fixtures.js";

const path = "/api/v1/submission-events";
const collaboratorOne = "66a64ab05bd7213b90d9b001";
const typeOne = "66a64ab05bd7213b90d9b010";
const documentOne = "66a64ab05bd7213b90d9c001";
const documentTwo = "66a64ab05bd7213b90d9c002";
const documentThree = "66a64ab05bd7213b90d9c003";
const unlinkedDocument = "66a64ab05bd7213b90d9c004";
const deletedDocument = "66a64ab05bd7213b90d9c005";

describe("Listing submission events", () => {
  bootstrapHttpMongo({
    beforeBootstrap: () => {
      process.env.RATE_LIMIT_GET = "100";
      process.env.RATE_LIMIT_WINDOW_MS = "60000";
    }
  });

  beforeEach(async () => {
    await resetDatabase(httpDatabase());
    await seedBaseReportingRows();
    PlatformTest.get<ReportingRuntime>(ReportingRuntime).resetRateLimiters();
  });

  afterAll(() => {
    delete process.env.RATE_LIMIT_GET;
    delete process.env.RATE_LIMIT_WINDOW_MS;
  });

  // SUB-EVENT-001
  it("returns every version of an active history with metadata, HAL, and ETag", async () => {
    const response = await list().expect(200);
    const items = collectionItems(response.body);
    const firstDocumentEvents = items.filter(({documentId}) => documentId === documentOne);

    expect(response.headers["content-type"]).toContain("application/hal+json");
    expect(response.headers.etag).toMatch(/^W\/"sha256:[a-f0-9]{64}"$/);
    expect(firstDocumentEvents).toHaveLength(3);
    expect(firstDocumentEvents[0]).toMatchObject({
      documentId: documentOne,
      version: 3,
      submittedAt: "2026-07-31T15:00:00.000Z",
      metadata: {
        originalName: "document-v3.pdf",
        mimeType: "application/pdf",
        sizeBytes: 3072,
        storageKey: `documents/${documentOne}/v3`,
        notes: "version 3"
      },
      _links: expect.any(Object)
    });
  });

  // SUB-EVENT-002
  it("combines exactly one event per version across different active documents", async () => {
    const response = await list().expect(200);
    const items = collectionItems(response.body);

    expect(items).toHaveLength(6);
    expect(new Set(items.map(({documentId, version}) => `${documentId}:${version}`)).size).toBe(6);
    expect(new Set(items.map(({documentId}) => documentId))).toEqual(
      new Set([documentOne, documentTwo, documentThree])
    );
  });

  // SUB-EVENT-003
  it("excludes versions belonging to unlinked or soft-deleted histories", async () => {
    const response = await list().expect(200);
    const ids = collectionItems(response.body).map(({documentId}) => documentId);

    expect(ids).not.toContain(unlinkedDocument);
    expect(ids).not.toContain(deletedDocument);
  });

  // SUB-EVENT-004
  it("sorts events by submission time in descending order", async () => {
    const response = await list().expect(200);
    const times = collectionItems(response.body).map(({submittedAt}) => submittedAt);

    expect(times).toEqual([...times].sort((left, right) => right.localeCompare(left)));
  });

  // SUB-EVENT-005
  it("breaks equal times by document id and then version in descending order", async () => {
    const response = await list().expect(200);
    const tied = collectionItems(response.body).filter(
      ({submittedAt}) => submittedAt === "2026-07-31T14:00:00.000Z"
    );

    expect(tied.map(({documentId, version}) => `${documentId}:${version}`)).toEqual([
      `${documentThree}:1`,
      `${documentTwo}:2`,
      `${documentOne}:2`,
      `${documentOne}:1`
    ]);
  });

  // SUB-EVENT-006
  it("returns an empty HAL collection when no active version exists", async () => {
    await resetDatabase(httpDatabase());

    const response = await list().expect(200);

    expect(response.body.count).toBe(0);
    expect(collectionItems(response.body)).toEqual([]);
  });

  // SUB-EVENT-007
  it("uses a default page of at most twenty events and publishes self", async () => {
    await seedReportingPage(25);
    const response = await list().expect(200);

    expect(collectionItems(response.body)).toHaveLength(20);
    expect(response.body._links.self.href).toContain("limit=20");
  });

  // SUB-EVENT-008
  it("accepts the minimum and maximum event page limits", async () => {
    await seedReportingPage(101);
    const minimum = await list({limit: 1}).expect(200);
    const maximum = await list({limit: 100}).expect(200);

    expect(collectionItems(minimum.body)).toHaveLength(1);
    expect(collectionItems(maximum.body)).toHaveLength(100);
  });

  // SUB-EVENT-009
  it("continues an opaque cursor page without duplicate or omitted events", async () => {
    await seedReportingPage(3);
    const first = await list({limit: 2}).expect(200);
    const second = await supertest(PlatformTest.callback())
      .get(first.body._links.next.href as string)
      .expect(200);
    const keys = [...collectionItems(first.body), ...collectionItems(second.body)].map(
      ({documentId, version}) => `${documentId}:${version}`
    );

    expect(keys).toHaveLength(3);
    expect(new Set(keys).size).toBe(3);
    expect(
      new URL(first.body._links.next.href as string, "http://localhost").searchParams.get("cursor")
    ).toEqual(expect.any(String));
  });

  // SUB-EVENT-010
  it("rejects an explicitly empty event cursor", async () => {
    const response = await list({cursor: ""}).expect(400);
    expectProblem(response, "INVALID_QUERY_PARAMETER", "cursor");
  });

  // SUB-EVENT-011, SUB-EVENT-012, SUB-EVENT-013
  it.each([
    ["0", "below the minimum"],
    ["101", "above the maximum"],
    ["1.5", "not an integer"]
  ])("rejects an event page limit that is %s", async (limit) => {
    const response = await list({limit}).expect(400);
    expectProblem(response, "INVALID_QUERY_PARAMETER", "limit");
  });

  // SUB-EVENT-014
  it("returns a bodyless 304 when the event collection ETag is revalidated", async () => {
    const first = await list().expect(200);
    const cached = await list()
      .set("If-None-Match", first.headers.etag as string)
      .expect(304);

    expect(cached.text).toBe("");
    expect(cached.body).toEqual({});
  });

  // SUB-EVENT-015
  it("returns a retryable problem after exceeding the event operation rate limit", async () => {
    const ip = "198.51.100.29";
    for (let attempt = 0; attempt < 100; attempt += 1) await list({}, ip);
    const response = await list({}, ip).expect(429);

    expectProblem(response, "RATE_LIMIT_EXCEEDED");
    expect(Number.parseInt(response.headers["retry-after"] as string, 10)).toBeGreaterThanOrEqual(
      1
    );
  });

  // SUB-EVENT-016
  it("sanitizes unexpected event reporting failures as an internal problem", async () => {
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

  // SUB-EVENT-017
  it("maps unavailable event persistence to a service problem", async () => {
    const getSpy = vi.spyOn(MongooseService.prototype, "get").mockReturnValue(undefined);
    try {
      const response = await list().expect(503);
      expectProblem(response, "SERVICE_UNAVAILABLE");
    } finally {
      getSpy.mockRestore();
    }
  });

  // SUB-EVENT-018
  it("rejects tampered, expired, and context-incompatible event cursors without a partial collection", async () => {
    await seedReportingPage(3);
    const first = await list({limit: 1}).expect(200);
    const next = new URL(first.body._links.next.href as string, "http://localhost");
    const validCursor = next.searchParams.get("cursor") as string;

    const tampered = await list({cursor: `${validCursor}tampered`, limit: 1}).expect(400);
    expectProblem(tampered, "INVALID_QUERY_PARAMETER", "cursor");
    expect(tampered.body._embedded).toBeUndefined();

    const {HmacCursorCodec} =
      await import("../../src/shared/infrastructure/security/hmac-cursor-codec.js");
    const expiredCursor = new HmacCursorCodec(cursorSecret, cursorClock()).encode({
      operationId: "listSubmissionEvents",
      filtersHash: "no-filters",
      order: "submittedAt:desc,documentId:desc,version:desc",
      limit: 1,
      position: {
        id: JSON.stringify({
          submittedAt: "2026-07-31T15:00:00.000Z",
          documentId: documentOne,
          version: 3
        })
      }
    });
    const expired = await list({cursor: expiredCursor, limit: 1}).expect(400);
    expectProblem(expired, "INVALID_QUERY_PARAMETER", "cursor");

    next.searchParams.set("limit", "2");
    const incompatible = await supertest(PlatformTest.callback())
      .get(`${next.pathname}${next.search}`)
      .expect(400);
    expectProblem(incompatible, "INVALID_QUERY_PARAMETER", "cursor");
  });
});

function list(query: Record<string, string | number> = {}, ip?: string) {
  const request = supertest(PlatformTest.callback()).get(path).query(query);
  return ip ? request.set("X-Forwarded-For", ip) : request;
}

function collectionItems(body: Record<string, unknown>): SubmissionEventFixture[] {
  const embedded = body._embedded;
  if (!embedded || typeof embedded !== "object" || Array.isArray(embedded)) return [];
  const items = (embedded as Record<string, unknown>)["submission-events"];
  return Array.isArray(items) ? (items as SubmissionEventFixture[]) : [];
}

function expectProblem(
  response: {status: number; headers: Record<string, string>; body: Record<string, unknown>},
  code: string,
  field?: string
): void {
  expect(response.headers["content-type"]).toContain("application/problem+json");
  expect(response.body).toMatchObject({
    type: expect.any(String),
    title: expect.any(String),
    status: response.status,
    detail: expect.any(String),
    instance: path,
    code,
    traceId: expect.any(String)
  });
  if (field) {
    expect(response.body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({field})])
    );
  }
}

async function seedBaseReportingRows(): Promise<void> {
  await httpDatabase()
    .collection("collaborator_documents")
    .insertMany([
      collaboratorDocumentRow(documentOne, [
        versionRow(documentOne, 1, "2026-07-31T14:00:00.000Z"),
        versionRow(documentOne, 2, "2026-07-31T14:00:00.000Z"),
        versionRow(documentOne, 3, "2026-07-31T15:00:00.000Z")
      ]),
      collaboratorDocumentRow(documentTwo, [
        versionRow(documentTwo, 1, "2026-07-31T13:00:00.000Z"),
        versionRow(documentTwo, 2, "2026-07-31T14:00:00.000Z")
      ]),
      collaboratorDocumentRow(documentThree, [
        versionRow(documentThree, 1, "2026-07-31T14:00:00.000Z")
      ]),
      collaboratorDocumentRow(
        unlinkedDocument,
        [versionRow(unlinkedDocument, 1, "2026-07-31T17:00:00.000Z")],
        {unlinkedAt: new Date("2026-07-31T17:30:00.000Z")}
      ),
      collaboratorDocumentRow(
        deletedDocument,
        [versionRow(deletedDocument, 1, "2026-07-31T18:00:00.000Z")],
        {deletedAt: new Date("2026-07-31T18:30:00.000Z")}
      )
    ]);
}

async function seedReportingPage(count: number): Promise<void> {
  await resetDatabase(httpDatabase());
  const fixtures = submissionEventPageFixtures(count);
  await httpDatabase()
    .collection("collaborator_documents")
    .insertMany(
      fixtures.map(({documentId, version, submittedAt, metadata}) =>
        collaboratorDocumentRow(documentId, [
          versionRow(documentId, version, submittedAt, metadata)
        ])
      )
    );
}

function collaboratorDocumentRow(
  id: string,
  versions: Document[],
  overrides: Partial<Document> = {}
): Document {
  const now = new Date("2026-07-30T12:00:00.000Z");
  const latest = versions.at(-1) as Document;
  return {
    _id: new ObjectId(id),
    collaboratorId: new ObjectId(collaboratorOne),
    documentTypeId: new ObjectId(typeOne),
    status: "SUBMITTED",
    currentVersion: latest.version,
    versions,
    lastSubmittedAt: latest.submittedAt,
    linkedAt: now,
    unlinkedAt: null,
    deletedAt: null,
    createdAt: now,
    updatedAt: latest.submittedAt,
    ...overrides
  };
}

function versionRow(
  documentId: string,
  version: number,
  submittedAt: string,
  metadata: SubmissionEventFixture["metadata"] = {
    originalName: `document-v${version}.pdf`,
    mimeType: "application/pdf",
    sizeBytes: version * 1024,
    storageKey: `documents/${documentId}/v${version}`,
    notes: `version ${version}`
  }
): Document {
  return {version, submittedAt: new Date(submittedAt), metadata};
}
