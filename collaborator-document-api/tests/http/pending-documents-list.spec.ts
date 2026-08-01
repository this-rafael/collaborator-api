import {afterAll, beforeEach, describe, expect, it, vi} from "vitest";
import {MongooseService} from "@tsed/mongoose";
import {PlatformTest} from "@tsed/platform-http/testing";
import {ObjectId, type Document} from "mongodb";
import supertest from "supertest";

import {cursorClock, cursorSecret} from "../helpers/cursor-runtime.js";
import {resetDatabase} from "../helpers/database.js";
import {bootstrapHttpMongo, httpDatabase} from "../helpers/http-mongo.js";
import {
  pendingDocumentPageFixtures,
  type PendingDocumentFixture
} from "../helpers/reporting-fixtures.js";
import {ReportingRuntime} from "../../src/modules/reporting/reporting.runtime.js";

const collaboratorOne = "66a64ab05bd7213b90d9b001";
const collaboratorTwo = "66a64ab05bd7213b90d9b002";
const collaboratorThree = "66a64ab05bd7213b90d9b003";
const typeOne = "66a64ab05bd7213b90d9b010";
const typeTwo = "66a64ab05bd7213b90d9b011";
const typeThree = "66a64ab05bd7213b90d9b012";

describe("Listing pending documents", () => {
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

  // QUERY-PENDING-001
  it("returns only active pending links with collaborator, document type, HAL, and ETag", async () => {
    const response = await list().expect(200);
    const items = collectionItems(response.body);

    expect(response.headers["content-type"]).toContain("application/hal+json");
    expect(response.headers.etag).toMatch(/^W\/"sha256:[a-f0-9]{64}"$/);
    expect(items.map(({id}) => id).sort()).toEqual(
      ["66a64ab05bd7213b90d9c001", "66a64ab05bd7213b90d9c002", "66a64ab05bd7213b90d9c003"].sort()
    );
    expect(items[0]).toMatchObject({
      status: "PENDING",
      collaborator: {id: expect.any(String), name: expect.any(String)},
      documentType: {id: expect.any(String), name: expect.any(String), code: expect.any(String)},
      _links: expect.any(Object)
    });
  });

  // QUERY-PENDING-002
  it("removes a pending link from the report immediately after its first submission", async () => {
    await httpDatabase()
      .collection("collaborator_documents")
      .updateOne(
        {_id: new ObjectId("66a64ab05bd7213b90d9c001")},
        {$set: {status: "SUBMITTED", currentVersion: 1, versions: [{version: 1}]}}
      );

    const response = await list().expect(200);

    expect(collectionItems(response.body).map(({id}) => id)).not.toContain(
      "66a64ab05bd7213b90d9c001"
    );
  });

  // QUERY-PENDING-003
  it("excludes unlinked and soft-deleted pending links", async () => {
    const response = await list().expect(200);
    const ids = collectionItems(response.body).map(({id}) => id);

    expect(ids).not.toContain("66a64ab05bd7213b90d9c005");
    expect(ids).not.toContain("66a64ab05bd7213b90d9c006");
  });

  // QUERY-PENDING-004
  it("filters collaborator names by normalized substring", async () => {
    const response = await list({collaboratorName: "  nA   mArIa "}).expect(200);

    expect(collectionItems(response.body).map(({collaborator}) => collaborator.id)).toEqual([
      collaboratorOne,
      collaboratorOne
    ]);
  });

  // QUERY-PENDING-005
  it("filters by exact normalized CPF", async () => {
    const response = await list({cpf: "98765432100"}).expect(200);

    expect(collectionItems(response.body).map(({collaborator}) => collaborator.id)).toEqual([
      collaboratorTwo
    ]);
  });

  // QUERY-PENDING-006
  it("filters document type names by normalized substring", async () => {
    const response = await list({documentTypeName: "  saUDE   ocupacional "}).expect(200);

    expect(collectionItems(response.body).map(({documentType}) => documentType.code)).toEqual([
      "ASO"
    ]);
  });

  // QUERY-PENDING-007
  it("filters document type codes by complete exact value", async () => {
    const exact = await list({documentTypeCode: "CTPS"}).expect(200);
    const prefix = await list({documentTypeCode: "CTP"}).expect(200);

    expect(collectionItems(exact.body).map(({documentType}) => documentType.code)).toEqual([
      "CTPS",
      "CTPS"
    ]);
    expect(collectionItems(prefix.body)).toEqual([]);
  });

  // QUERY-PENDING-008
  it("combines all normalized filters with AND", async () => {
    const response = await list({
      collaboratorName: "ana maria",
      cpf: "12345678909",
      documentTypeName: "carteira",
      documentTypeCode: "CTPS"
    }).expect(200);

    expect(collectionItems(response.body).map(({id}) => id)).toEqual(["66a64ab05bd7213b90d9c003"]);
  });

  // QUERY-PENDING-009
  it("returns an empty HAL collection when no pending link matches", async () => {
    const response = await list({cpf: "00000000000"}).expect(200);

    expect(response.body.count).toBe(0);
    expect(collectionItems(response.body)).toEqual([]);
  });

  // QUERY-PENDING-010
  it("rejects a CPF that does not contain exactly eleven digits", async () => {
    const response = await list({cpf: "123"}).expect(400);
    expectProblem(response, "INVALID_QUERY_PARAMETER", "cpf");
  });

  // QUERY-PENDING-011
  it("rejects a document type code outside the uppercase contract", async () => {
    const response = await list({documentTypeCode: "aso"}).expect(400);
    expectProblem(response, "INVALID_QUERY_PARAMETER", "documentTypeCode");
  });

  // QUERY-PENDING-012
  it("uses a default page of at most twenty items and publishes self", async () => {
    await seedReportingPage(25);
    const response = await list().expect(200);

    expect(collectionItems(response.body)).toHaveLength(20);
    expect(response.body._links.self.href).toContain("limit=20");
  });

  // QUERY-PENDING-013
  it("accepts the minimum and maximum page limits", async () => {
    await seedReportingPage(101);
    const minimum = await list({limit: 1}).expect(200);
    const maximum = await list({limit: 100}).expect(200);

    expect(collectionItems(minimum.body)).toHaveLength(1);
    expect(collectionItems(maximum.body)).toHaveLength(100);
  });

  // QUERY-PENDING-014
  it("continues an opaque cursor page without duplicate or omitted items", async () => {
    await seedReportingPage(3);
    const first = await list({limit: 2}).expect(200);
    const second = await supertest(PlatformTest.callback())
      .get(first.body._links.next.href as string)
      .expect(200);
    const ids = [...collectionItems(first.body), ...collectionItems(second.body)].map(({id}) => id);

    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
    expect(
      new URL(first.body._links.next.href as string, "http://localhost").searchParams.get("cursor")
    ).toEqual(expect.any(String));
  });

  // QUERY-PENDING-015
  it("rejects an explicitly empty cursor", async () => {
    const response = await list({cursor: ""}).expect(400);
    expectProblem(response, "INVALID_QUERY_PARAMETER", "cursor");
  });

  // QUERY-PENDING-016, QUERY-PENDING-017, QUERY-PENDING-018
  it.each([
    ["0", "below the minimum"],
    ["101", "above the maximum"],
    ["1.5", "not an integer"]
  ])("rejects a page limit that is %s", async (limit) => {
    const response = await list({limit}).expect(400);
    expectProblem(response, "INVALID_QUERY_PARAMETER", "limit");
  });

  // QUERY-PENDING-019
  it("returns a bodyless 304 when the current ETag is revalidated", async () => {
    const first = await list().expect(200);
    const cached = await list()
      .set("If-None-Match", first.headers.etag as string)
      .expect(304);

    expect(cached.text).toBe("");
    expect(cached.body).toEqual({});
  });

  // QUERY-PENDING-020
  it("returns a retryable problem after exceeding the operation rate limit", async () => {
    const ip = "198.51.100.25";
    for (let attempt = 0; attempt < 100; attempt += 1) await list({}, ip);
    const response = await list({}, ip).expect(429);

    expectProblem(response, "RATE_LIMIT_EXCEEDED");
    expect(Number.parseInt(response.headers["retry-after"] as string, 10)).toBeGreaterThanOrEqual(
      1
    );
  });

  // QUERY-PENDING-021
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

  // QUERY-PENDING-022
  it("maps unavailable reporting persistence to a service problem", async () => {
    const getSpy = vi.spyOn(MongooseService.prototype, "get").mockReturnValue(undefined);
    try {
      const response = await list().expect(503);
      expectProblem(response, "SERVICE_UNAVAILABLE");
    } finally {
      getSpy.mockRestore();
    }
  });

  // QUERY-PENDING-023
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
      operationId: "listPendingDocuments",
      filtersHash: "no-filters",
      order: "documentTypeId:asc,collaboratorId:asc,_id:asc",
      limit: 1,
      position: {id: "66a64ab05bd7213b90d9d001"}
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
  const request = supertest(PlatformTest.callback()).get("/api/v1/pending-documents").query(query);
  return ip ? request.set("X-Forwarded-For", ip) : request;
}

function collectionItems(body: Record<string, unknown>): PendingDocumentFixture[] {
  const embedded = body._embedded;
  if (!embedded || typeof embedded !== "object" || Array.isArray(embedded)) return [];
  const items = (embedded as Record<string, unknown>)["pending-documents"];
  return Array.isArray(items) ? (items as PendingDocumentFixture[]) : [];
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
    instance: "/api/v1/pending-documents",
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
    collaboratorDocumentRow("66a64ab05bd7213b90d9c001", collaboratorOne, typeOne),
    collaboratorDocumentRow("66a64ab05bd7213b90d9c002", collaboratorTwo, typeTwo),
    collaboratorDocumentRow("66a64ab05bd7213b90d9c003", collaboratorOne, typeTwo),
    collaboratorDocumentRow("66a64ab05bd7213b90d9c005", collaboratorTwo, typeOne, {
      unlinkedAt: new Date("2026-07-30T13:00:00.000Z")
    }),
    collaboratorDocumentRow("66a64ab05bd7213b90d9c006", collaboratorThree, typeThree, {
      deletedAt: new Date("2026-07-30T14:00:00.000Z")
    })
  ]);
}

async function seedReportingPage(count: number): Promise<void> {
  await resetDatabase(httpDatabase());
  const fixtures = pendingDocumentPageFixtures(count);
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
      fixtures.map(({id, collaborator, documentType}) =>
        collaboratorDocumentRow(id, collaborator.id, documentType.id)
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
  const now = new Date("2026-07-30T12:00:00.000Z");
  return {
    _id: new ObjectId(id),
    collaboratorId,
    documentTypeId,
    status: "PENDING",
    currentVersion: null,
    versions: [],
    lastSubmittedAt: null,
    linkedAt: now,
    unlinkedAt: null,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
