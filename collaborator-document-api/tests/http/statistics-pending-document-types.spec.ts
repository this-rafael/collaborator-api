import {afterAll, beforeEach, describe, expect, it, vi} from "vitest";
import {MongooseService} from "@tsed/mongoose";
import {PlatformTest} from "@tsed/platform-http/testing";
import {ObjectId, type Document} from "mongodb";
import supertest from "supertest";

import {ReportingRuntime} from "../../src/modules/reporting/reporting.runtime.js";
import {cursorClock, cursorSecret} from "../helpers/cursor-runtime.js";
import {resetDatabase} from "../helpers/database.js";
import {bootstrapHttpMongo, httpDatabase} from "../helpers/http-mongo.js";
import type {PendingDocumentTypeStatisticFixture} from "../helpers/reporting-fixtures.js";

const path = "/api/v1/statistics/pending-document-types";
const collaboratorId = "66a64ab05bd7213b90d9b001";
const typeOne = "66a64ab05bd7213b90d9b010";
const typeTwo = "66a64ab05bd7213b90d9b011";
const typeThree = "66a64ab05bd7213b90d9b012";
const typeWithoutPendingDocuments = "66a64ab05bd7213b90d9b013";

describe("Listing pending document type statistics", () => {
  bootstrapHttpMongo({
    beforeBootstrap: () => {
      process.env.RATE_LIMIT_GET = "100";
      process.env.RATE_LIMIT_WINDOW_MS = "60000";
    }
  });

  beforeEach(async () => {
    await resetDatabase(httpDatabase());
    await seedBaseStatisticsRows();
    PlatformTest.get<ReportingRuntime>(ReportingRuntime).resetRateLimiters();
  });

  afterAll(() => {
    delete process.env.RATE_LIMIT_GET;
    delete process.env.RATE_LIMIT_WINDOW_MS;
  });

  // STAT-TYPE-001
  it("groups active pending links once per document type", async () => {
    const response = await listStatistics().expect(200);
    const items = statisticsItems(response.body);

    expect(response.headers["content-type"]).toContain("application/hal+json");
    expect(items).toHaveLength(3);
    expect(items.map(({documentType, pendingCount}) => [documentType.id, pendingCount])).toEqual([
      [typeOne, 3],
      [typeTwo, 2],
      [typeThree, 2]
    ]);
    expect(items.every(({pendingCount}) => pendingCount >= 1)).toBe(true);
  });

  // STAT-TYPE-002
  it("excludes submitted, unlinked, and soft-deleted links from each pending count", async () => {
    const response = await listStatistics().expect(200);
    const first = statisticsItems(response.body).find(
      ({documentType}) => documentType.id === typeOne
    );

    expect(first?.pendingCount).toBe(3);
  });

  // STAT-TYPE-003
  it("orders document types by descending pending count", async () => {
    const response = await listStatistics().expect(200);
    const counts = statisticsItems(response.body).map(({pendingCount}) => pendingCount);

    expect(counts).toEqual([3, 2, 2]);
  });

  // STAT-TYPE-004
  it("breaks equal pending counts by ascending document type identifier", async () => {
    const response = await listStatistics().expect(200);
    const tiedIds = statisticsItems(response.body)
      .filter(({pendingCount}) => pendingCount === 2)
      .map(({documentType}) => documentType.id);

    expect(tiedIds).toEqual([typeTwo, typeThree]);
  });

  // STAT-TYPE-005
  it("omits active document types without pending links", async () => {
    const response = await listStatistics().expect(200);

    expect(statisticsItems(response.body).map(({documentType}) => documentType.id)).not.toContain(
      typeWithoutPendingDocuments
    );
  });

  // STAT-TYPE-006
  it("returns an empty HAL collection when there are no active pending links", async () => {
    await resetDatabase(httpDatabase());

    const response = await listStatistics().expect(200);

    expect(response.headers["content-type"]).toContain("application/hal+json");
    expect(response.body.count).toBe(0);
    expect(statisticsItems(response.body)).toEqual([]);
  });

  // STAT-TYPE-007
  it("uses a default page of at most twenty document types and publishes self", async () => {
    await seedStatisticsPage(25);

    const response = await listStatistics().expect(200);

    expect(statisticsItems(response.body)).toHaveLength(20);
    expect(response.body._links.self.href).toContain("limit=20");
  });

  // STAT-TYPE-008
  it("accepts the minimum and maximum page limits", async () => {
    await seedStatisticsPage(101);

    const minimum = await listStatistics({limit: 1}).expect(200);
    const maximum = await listStatistics({limit: 100}).expect(200);

    expect(statisticsItems(minimum.body)).toHaveLength(1);
    expect(statisticsItems(maximum.body)).toHaveLength(100);
  });

  // STAT-TYPE-009
  it("continues an opaque cursor across a count tie without duplicates or omissions", async () => {
    const first = await listStatistics({limit: 2}).expect(200);
    const second = await supertest(PlatformTest.callback())
      .get(first.body._links.next.href as string)
      .expect(200);
    const ids = [...statisticsItems(first.body), ...statisticsItems(second.body)].map(
      ({documentType}) => documentType.id
    );

    expect(ids).toEqual([typeOne, typeTwo, typeThree]);
    expect(new Set(ids).size).toBe(3);
    expect(
      new URL(first.body._links.next.href as string, "http://localhost").searchParams.get("cursor")
    ).toEqual(expect.any(String));
  });

  // STAT-TYPE-010
  it("rejects an explicitly empty cursor", async () => {
    const response = await listStatistics({cursor: ""}).expect(400);
    expectProblem(response, "INVALID_QUERY_PARAMETER", "cursor");
  });

  // STAT-TYPE-011, STAT-TYPE-012, STAT-TYPE-013
  it.each([
    ["0", "below the minimum"],
    ["101", "above the maximum"],
    ["1.5", "not an integer"]
  ])("rejects a page limit that is %s", async (limit) => {
    const response = await listStatistics({limit}).expect(400);
    expectProblem(response, "INVALID_QUERY_PARAMETER", "limit");
  });

  // STAT-TYPE-014
  it("returns a bodyless 304 when the current ETag is revalidated", async () => {
    const first = await listStatistics().expect(200);
    const cached = await listStatistics()
      .set("If-None-Match", first.headers.etag as string)
      .expect(304);

    expect(cached.text).toBe("");
    expect(cached.body).toEqual({});
  });

  // STAT-TYPE-015
  it("returns a retryable problem after exceeding the operation rate limit", async () => {
    const ip = "198.51.100.27";
    for (let attempt = 0; attempt < 100; attempt += 1) await listStatistics({}, ip);

    const response = await listStatistics({}, ip).expect(429);

    expectProblem(response, "RATE_LIMIT_EXCEEDED");
    expect(Number.parseInt(response.headers["retry-after"] as string, 10)).toBeGreaterThanOrEqual(
      1
    );
  });

  // STAT-TYPE-016
  it("sanitizes unexpected reporting failures as an internal problem", async () => {
    const getSpy = vi.spyOn(MongooseService.prototype, "get").mockImplementation(() => {
      throw new Error("database internals must not leak");
    });
    try {
      const response = await listStatistics().expect(500);
      expectProblem(response, "INTERNAL_SERVER_ERROR");
      expect(JSON.stringify(response.body)).not.toMatch(/database internals|stack|node_modules/);
    } finally {
      getSpy.mockRestore();
    }
  });

  // STAT-TYPE-017
  it("maps unavailable reporting persistence to a service problem", async () => {
    const getSpy = vi.spyOn(MongooseService.prototype, "get").mockReturnValue(undefined);
    try {
      const response = await listStatistics().expect(503);
      expectProblem(response, "SERVICE_UNAVAILABLE");
    } finally {
      getSpy.mockRestore();
    }
  });

  // STAT-TYPE-018
  it("rejects tampered, expired, and context-incompatible cursors without a partial ranking", async () => {
    const first = await listStatistics({limit: 1}).expect(200);
    const next = new URL(first.body._links.next.href as string, "http://localhost");
    const validCursor = next.searchParams.get("cursor") as string;

    const tampered = await listStatistics({cursor: `${validCursor}tampered`, limit: 1}).expect(400);
    expectProblem(tampered, "INVALID_QUERY_PARAMETER", "cursor");
    expect(tampered.body._embedded).toBeUndefined();

    const {HmacCursorCodec} =
      await import("../../src/shared/infrastructure/security/hmac-cursor-codec.js");
    const expiredCursor = new HmacCursorCodec(cursorSecret, cursorClock()).encode({
      operationId: "listPendingDocumentTypeStatistics",
      filtersHash: "no-filters",
      order: "pendingCount:desc,documentTypeId:asc",
      limit: 1,
      position: {id: typeOne}
    });
    const expired = await listStatistics({cursor: expiredCursor, limit: 1}).expect(400);
    expectProblem(expired, "INVALID_QUERY_PARAMETER", "cursor");

    next.searchParams.set("limit", "2");
    const incompatible = await supertest(PlatformTest.callback())
      .get(`${next.pathname}${next.search}`)
      .expect(400);
    expectProblem(incompatible, "INVALID_QUERY_PARAMETER", "cursor");
  });
});

function listStatistics(query: Record<string, string | number> = {}, ip?: string) {
  const request = supertest(PlatformTest.callback()).get(path).query(query);
  return ip ? request.set("X-Forwarded-For", ip) : request;
}

function statisticsItems(body: Record<string, unknown>): PendingDocumentTypeStatisticFixture[] {
  const embedded = body._embedded;
  if (!embedded || typeof embedded !== "object" || Array.isArray(embedded)) return [];
  const items = (embedded as Record<string, unknown>)["document-types"];
  return Array.isArray(items) ? (items as PendingDocumentTypeStatisticFixture[]) : [];
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

async function seedBaseStatisticsRows(): Promise<void> {
  await httpDatabase()
    .collection("document_types")
    .insertMany([
      documentTypeRow(typeOne, "Atestado de Saúde Ocupacional", "ASO"),
      documentTypeRow(typeTwo, "Carteira de Trabalho", "CTPS"),
      documentTypeRow(typeThree, "Registro Geral", "RG"),
      documentTypeRow(typeWithoutPendingDocuments, "Título de Eleitor", "TE")
    ]);
  await httpDatabase()
    .collection("collaborator_documents")
    .insertMany([
      ...Array.from({length: 3}, (_, index) => collaboratorDocumentRow(index + 1, typeOne)),
      ...Array.from({length: 2}, (_, index) => collaboratorDocumentRow(index + 10, typeTwo)),
      ...Array.from({length: 2}, (_, index) => collaboratorDocumentRow(index + 20, typeThree)),
      collaboratorDocumentRow(30, typeOne, {status: "SUBMITTED"}),
      collaboratorDocumentRow(31, typeOne, {
        unlinkedAt: new Date("2026-07-31T13:00:00.000Z")
      }),
      collaboratorDocumentRow(32, typeOne, {
        deletedAt: new Date("2026-07-31T14:00:00.000Z")
      })
    ]);
}

async function seedStatisticsPage(count: number): Promise<void> {
  await resetDatabase(httpDatabase());
  const types = Array.from({length: count}, (_, index) => {
    const id = hexadecimalId("66a64ab05bd7213b90d9e000", index + 1);
    return documentTypeRow(
      id,
      `Tipo ${String(index + 1).padStart(3, "0")}`,
      `TYPE_${String(index + 1).padStart(3, "0")}`
    );
  });
  await httpDatabase().collection("document_types").insertMany(types);
  await httpDatabase()
    .collection("collaborator_documents")
    .insertMany(
      types.map(({_id}, index) =>
        collaboratorDocumentRow(index + 1, (_id as ObjectId).toHexString())
      )
    );
}

function documentTypeRow(id: string, name: string, code: string): Document {
  const now = new Date("2026-07-31T12:00:00.000Z");
  return {
    _id: new ObjectId(id),
    name,
    nameNormalized: name.toLocaleLowerCase("pt-BR"),
    code,
    description: null,
    deletedAt: null,
    createdAt: now,
    updatedAt: now
  };
}

function collaboratorDocumentRow(
  offset: number,
  documentTypeId: string,
  overrides: Partial<Document> = {}
): Document {
  const now = new Date("2026-07-31T12:00:00.000Z");
  return {
    _id: new ObjectId(hexadecimalId("66a64ab05bd7213b90d9c000", offset)),
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

function hexadecimalId(base: string, offset: number): string {
  return (BigInt(`0x${base}`) + BigInt(offset)).toString(16).padStart(24, "0");
}
