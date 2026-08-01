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
  latestSubmissionPageFixtures,
  type LatestSubmissionFixture
} from "../helpers/reporting-fixtures.js";

const path = "/api/v1/submissions/latest";
const collaboratorOne = "66a64ab05bd7213b90d9b001";
const collaboratorTwo = "66a64ab05bd7213b90d9b002";
const collaboratorThree = "66a64ab05bd7213b90d9b003";
const typeOne = "66a64ab05bd7213b90d9b010";
const typeTwo = "66a64ab05bd7213b90d9b011";
const typeThree = "66a64ab05bd7213b90d9b012";
const documentOne = "66a64ab05bd7213b90d9c001";
const documentTwo = "66a64ab05bd7213b90d9c002";
const documentThree = "66a64ab05bd7213b90d9c003";

describe("Listing latest submissions", () => {
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

  // SUB-LATEST-001
  it("returns one latest snapshot per active submitted link with summaries, HAL, and ETag", async () => {
    const response = await list().expect(200);
    const items = collectionItems(response.body);

    expect(response.headers["content-type"]).toContain("application/hal+json");
    expect(response.headers.etag).toMatch(/^W\/"sha256:[a-f0-9]{64}"$/);
    expect(items.map(({documentId}) => documentId)).toEqual([
      documentOne,
      documentThree,
      documentTwo
    ]);
    expect(items[0]).toMatchObject({
      documentId: documentOne,
      currentVersion: 2,
      lastSubmittedAt: "2026-07-31T15:00:00.000Z",
      collaborator: {id: collaboratorOne, name: "Ana María Silva"},
      documentType: {id: typeOne, name: "Atestado de Saúde Ocupacional", code: "ASO"},
      _links: expect.any(Object)
    });
  });

  // SUB-LATEST-002
  it("replaces the visible snapshot after a new version without duplicating the link", async () => {
    await httpDatabase()
      .collection("collaborator_documents")
      .updateOne(
        {_id: new ObjectId(documentTwo)},
        {
          $set: {
            currentVersion: 2,
            lastSubmittedAt: new Date("2026-07-31T16:00:00.000Z"),
            versions: [
              {
                version: 1,
                submittedAt: new Date("2026-07-31T14:00:00.000Z"),
                metadata: {originalName: "document-v1.pdf"}
              },
              {
                version: 2,
                submittedAt: new Date("2026-07-31T16:00:00.000Z"),
                metadata: {originalName: "renewed.pdf"}
              }
            ]
          }
        }
      );

    const response = await list().expect(200);
    const items = collectionItems(response.body);
    const updated = items.filter(({documentId}) => documentId === documentTwo);

    expect(updated).toHaveLength(1);
    expect(updated[0]).toMatchObject({
      currentVersion: 2,
      lastSubmittedAt: "2026-07-31T16:00:00.000Z"
    });
    expect(items[0]?.documentId).toBe(documentTwo);
  });

  // SUB-LATEST-003
  it("excludes pending, unlinked, deleted, and incomplete historical rows", async () => {
    const response = await list().expect(200);

    expect(
      collectionItems(response.body)
        .map(({documentId}) => documentId)
        .sort()
    ).toEqual([documentOne, documentTwo, documentThree].sort());
  });

  // SUB-LATEST-004
  it("sorts snapshots by last submission time in descending order", async () => {
    const response = await list().expect(200);

    expect(collectionItems(response.body).map(({lastSubmittedAt}) => lastSubmittedAt)).toEqual([
      "2026-07-31T15:00:00.000Z",
      "2026-07-31T14:00:00.000Z",
      "2026-07-31T14:00:00.000Z"
    ]);
  });

  // SUB-LATEST-005
  it("breaks equal submission times by document id in descending order", async () => {
    const response = await list().expect(200);
    const tied = collectionItems(response.body).filter(
      ({lastSubmittedAt}) => lastSubmittedAt === "2026-07-31T14:00:00.000Z"
    );

    expect(tied.map(({documentId}) => documentId)).toEqual([documentThree, documentTwo]);
  });

  // SUB-LATEST-006
  it("returns an empty HAL collection when no active submitted link exists", async () => {
    await resetDatabase(httpDatabase());

    const response = await list().expect(200);

    expect(response.body.count).toBe(0);
    expect(collectionItems(response.body)).toEqual([]);
  });

  // SUB-LATEST-007
  it("uses a default page of at most twenty items and publishes self", async () => {
    await seedReportingPage(25);
    const response = await list().expect(200);

    expect(collectionItems(response.body)).toHaveLength(20);
    expect(response.body._links.self.href).toContain("limit=20");
  });

  // SUB-LATEST-008
  it("accepts the minimum and maximum page limits", async () => {
    await seedReportingPage(101);
    const minimum = await list({limit: 1}).expect(200);
    const maximum = await list({limit: 100}).expect(200);

    expect(collectionItems(minimum.body)).toHaveLength(1);
    expect(collectionItems(maximum.body)).toHaveLength(100);
  });

  // SUB-LATEST-009
  it("continues an opaque cursor page without duplicate or omitted snapshots", async () => {
    await seedReportingPage(3);
    const first = await list({limit: 2}).expect(200);
    const second = await supertest(PlatformTest.callback())
      .get(first.body._links.next.href as string)
      .expect(200);
    const ids = [...collectionItems(first.body), ...collectionItems(second.body)].map(
      ({documentId}) => documentId
    );

    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
    expect(
      new URL(first.body._links.next.href as string, "http://localhost").searchParams.get("cursor")
    ).toEqual(expect.any(String));
  });

  // SUB-LATEST-010
  it("rejects an explicitly empty cursor", async () => {
    const response = await list({cursor: ""}).expect(400);
    expectProblem(response, "INVALID_QUERY_PARAMETER", "cursor");
  });

  // SUB-LATEST-011, SUB-LATEST-012, SUB-LATEST-013
  it.each([
    ["0", "below the minimum"],
    ["101", "above the maximum"],
    ["1.5", "not an integer"]
  ])("rejects a page limit that is %s", async (limit) => {
    const response = await list({limit}).expect(400);
    expectProblem(response, "INVALID_QUERY_PARAMETER", "limit");
  });

  // SUB-LATEST-014
  it("returns a bodyless 304 when the current ETag is revalidated", async () => {
    const first = await list().expect(200);
    const cached = await list()
      .set("If-None-Match", first.headers.etag as string)
      .expect(304);

    expect(cached.text).toBe("");
    expect(cached.body).toEqual({});
  });

  // SUB-LATEST-015
  it("returns a retryable problem after exceeding the operation rate limit", async () => {
    const ip = "198.51.100.28";
    for (let attempt = 0; attempt < 100; attempt += 1) await list({}, ip);
    const response = await list({}, ip).expect(429);

    expectProblem(response, "RATE_LIMIT_EXCEEDED");
    expect(Number.parseInt(response.headers["retry-after"] as string, 10)).toBeGreaterThanOrEqual(
      1
    );
  });

  // SUB-LATEST-016
  it("sanitizes unexpected reporting failures as an internal problem", async () => {
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

  // SUB-LATEST-017
  it("maps unavailable reporting persistence to a service problem", async () => {
    const getSpy = vi.spyOn(MongooseService.prototype, "get").mockReturnValue(undefined);
    try {
      const response = await list().expect(503);
      expectProblem(response, "SERVICE_UNAVAILABLE");
    } finally {
      getSpy.mockRestore();
    }
  });

  // SUB-LATEST-018
  it("rejects tampered, expired, and context-incompatible cursors without a partial collection", async () => {
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
      operationId: "listLatestSubmissions",
      filtersHash: "no-filters",
      order: "lastSubmittedAt:desc,_id:desc",
      limit: 1,
      position: {id: "2026-07-31T15:00:00.000Z|66a64ab05bd7213b90d9d001"}
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

function collectionItems(body: Record<string, unknown>): LatestSubmissionFixture[] {
  const embedded = body._embedded;
  if (!embedded || typeof embedded !== "object" || Array.isArray(embedded)) return [];
  const items = (embedded as Record<string, unknown>).submissions;
  return Array.isArray(items) ? (items as LatestSubmissionFixture[]) : [];
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
  const database = httpDatabase();
  await database
    .collection("collaborators")
    .insertMany([
      collaboratorRow(collaboratorOne, "Ana María Silva", "12345678909"),
      collaboratorRow(collaboratorTwo, "Bruno Lima", "98765432100"),
      collaboratorRow(collaboratorThree, "Carlos Santos", "11111111111")
    ]);
  await database
    .collection("document_types")
    .insertMany([
      documentTypeRow(typeOne, "Atestado de Saúde Ocupacional", "ASO"),
      documentTypeRow(typeTwo, "Carteira de Trabalho", "CTPS"),
      documentTypeRow(typeThree, "Registro Geral", "RG")
    ]);
  await database.collection("collaborator_documents").insertMany([
    collaboratorDocumentRow(documentOne, collaboratorOne, typeOne, {
      currentVersion: 2,
      lastSubmittedAt: new Date("2026-07-31T15:00:00.000Z"),
      versions: submittedVersions(2, "2026-07-31T15:00:00.000Z")
    }),
    collaboratorDocumentRow(documentTwo, collaboratorTwo, typeTwo, {
      lastSubmittedAt: new Date("2026-07-31T14:00:00.000Z")
    }),
    collaboratorDocumentRow(documentThree, collaboratorThree, typeThree, {
      currentVersion: 3,
      lastSubmittedAt: new Date("2026-07-31T14:00:00.000Z"),
      versions: submittedVersions(3, "2026-07-31T14:00:00.000Z")
    }),
    collaboratorDocumentRow("66a64ab05bd7213b90d9c004", collaboratorOne, typeTwo, {
      status: "PENDING",
      currentVersion: 0,
      versions: [],
      lastSubmittedAt: null
    }),
    collaboratorDocumentRow("66a64ab05bd7213b90d9c005", collaboratorTwo, typeOne, {
      lastSubmittedAt: new Date("2026-07-31T17:00:00.000Z"),
      unlinkedAt: new Date("2026-07-31T17:30:00.000Z")
    }),
    collaboratorDocumentRow("66a64ab05bd7213b90d9c006", collaboratorThree, typeThree, {
      lastSubmittedAt: new Date("2026-07-31T18:00:00.000Z"),
      deletedAt: new Date("2026-07-31T18:30:00.000Z")
    }),
    collaboratorDocumentRow("66a64ab05bd7213b90d9c007", collaboratorOne, typeThree, {
      lastSubmittedAt: null
    })
  ]);
}

async function seedReportingPage(count: number): Promise<void> {
  await resetDatabase(httpDatabase());
  const fixtures = latestSubmissionPageFixtures(count);
  await httpDatabase()
    .collection("collaborators")
    .insertOne(collaboratorRow(collaboratorOne, "Ana María Silva", "12345678909"));
  await httpDatabase()
    .collection("document_types")
    .insertMany(
      fixtures.map(({documentType}) =>
        documentTypeRow(documentType.id, documentType.name, documentType.code)
      )
    );
  await httpDatabase()
    .collection("collaborator_documents")
    .insertMany(
      fixtures.map(({documentId, currentVersion, lastSubmittedAt, collaborator, documentType}) =>
        collaboratorDocumentRow(documentId, collaborator.id, documentType.id, {
          currentVersion,
          lastSubmittedAt: new Date(lastSubmittedAt),
          versions: submittedVersions(currentVersion, lastSubmittedAt)
        })
      )
    );
}

function collaboratorRow(id: string, name: string, cpf: string): Document {
  const now = new Date("2026-07-30T12:00:00.000Z");
  return {
    _id: new ObjectId(id),
    name,
    nameNormalized: normalize(name),
    cpf,
    email: `${id}@example.com`,
    deletedAt: null,
    createdAt: now,
    updatedAt: now
  };
}

function documentTypeRow(id: string, name: string, code: string): Document {
  const now = new Date("2026-07-30T12:00:00.000Z");
  return {
    _id: new ObjectId(id),
    name,
    nameNormalized: normalize(name),
    code,
    description: null,
    deletedAt: null,
    createdAt: now,
    updatedAt: now
  };
}

function collaboratorDocumentRow(
  id: string,
  collaboratorId: string,
  documentTypeId: string,
  overrides: Partial<Document> = {}
): Document {
  const submittedAt = new Date("2026-07-31T13:00:00.000Z");
  const now = new Date("2026-07-30T12:00:00.000Z");
  return {
    _id: new ObjectId(id),
    collaboratorId,
    documentTypeId,
    status: "SUBMITTED",
    currentVersion: 1,
    versions: submittedVersions(1, submittedAt.toISOString()),
    lastSubmittedAt: submittedAt,
    linkedAt: now,
    unlinkedAt: null,
    deletedAt: null,
    createdAt: now,
    updatedAt: submittedAt,
    ...overrides
  };
}

function submittedVersions(count: number, latestAt: string): Document[] {
  const latest = Date.parse(latestAt);
  return Array.from({length: count}, (_, index) => ({
    version: index + 1,
    submittedAt: new Date(latest - (count - index - 1) * 60_000),
    metadata: {originalName: `document-v${index + 1}.pdf`}
  }));
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
