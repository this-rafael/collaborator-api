import {afterAll, beforeEach, describe, expect, it, vi} from "vitest";
import {MongooseService} from "@tsed/mongoose";
import {PlatformTest} from "@tsed/platform-http/testing";
import {ObjectId, type Document} from "mongodb";
import supertest from "supertest";

import {ReportingRuntime} from "../../src/modules/reporting/reporting.runtime.js";
import {resetDatabase} from "../helpers/database.js";
import {bootstrapHttpMongo, httpDatabase} from "../helpers/http-mongo.js";
import type {CompletenessStatisticsFixture} from "../helpers/reporting-fixtures.js";

const path = "/api/v1/statistics/completeness";
const collaboratorId = "66a64ab05bd7213b90d9b001";
const documentTypeId = "66a64ab05bd7213b90d9b010";

describe("Getting completeness statistics", () => {
  bootstrapHttpMongo({
    beforeBootstrap: () => {
      process.env.RATE_LIMIT_GET = "2";
      process.env.RATE_LIMIT_WINDOW_MS = "60000";
    }
  });

  beforeEach(async () => {
    await resetDatabase(httpDatabase());
    PlatformTest.get<ReportingRuntime>(ReportingRuntime).resetRateLimiters();
  });

  afterAll(() => {
    delete process.env.RATE_LIMIT_GET;
    delete process.env.RATE_LIMIT_WINDOW_MS;
  });

  // STAT-COMP-001
  it("returns zero completeness when there are no active links", async () => {
    const response = await getStatistics().expect(200);

    expect(response.headers["content-type"]).toContain("application/hal+json");
    expect(response.body).toMatchObject({
      totalActiveDocuments: 0,
      submittedDocuments: 0,
      pendingDocuments: 0,
      percentage: 0
    });
  });

  // STAT-COMP-002
  it("returns zero completeness when every active link is pending", async () => {
    await seedLinks(["PENDING", "PENDING", "PENDING"]);

    const response = await getStatistics().expect(200);

    expect(response.headers["content-type"]).toContain("application/hal+json");
    expect(response.body).toMatchObject({
      totalActiveDocuments: 3,
      submittedDocuments: 0,
      pendingDocuments: 3,
      percentage: 0
    });
  });

  // STAT-COMP-003
  it("returns full completeness when every active link is submitted", async () => {
    await seedLinks(["SUBMITTED", "SUBMITTED", "SUBMITTED"]);

    const response = await getStatistics().expect(200);

    expect(response.headers["content-type"]).toContain("application/hal+json");
    expect(response.body).toMatchObject({
      totalActiveDocuments: 3,
      submittedDocuments: 3,
      pendingDocuments: 0,
      percentage: 100
    });
  });

  // STAT-COMP-004
  it.each([
    [1, 2, 33.33],
    [2, 1, 66.67],
    [1, 5, 16.67]
  ])(
    "returns %s submitted and %s pending links with the expected decimal percentage",
    async (submitted, pending, percentage) => {
      await seedLinks([
        ...Array.from({length: submitted}, () => "SUBMITTED" as const),
        ...Array.from({length: pending}, () => "PENDING" as const)
      ]);

      const response = await getStatistics().expect(200);

      expect(response.headers["content-type"]).toContain("application/hal+json");
      expect(response.body).toMatchObject({
        totalActiveDocuments: submitted + pending,
        submittedDocuments: submitted,
        pendingDocuments: pending,
        percentage
      });
      expect(typeof response.body.percentage).toBe("number");
    }
  );

  // STAT-COMP-005
  it("excludes unlinked and soft-deleted historical links from both counts", async () => {
    await seedLinks(["PENDING", "SUBMITTED"]);
    await httpDatabase()
      .collection("collaborator_documents")
      .insertMany([
        collaboratorDocumentRow(100, "SUBMITTED", {
          unlinkedAt: new Date("2026-07-31T12:30:00.000Z")
        }),
        collaboratorDocumentRow(101, "SUBMITTED", {
          deletedAt: new Date("2026-07-31T12:45:00.000Z")
        })
      ]);

    const response = await getStatistics().expect(200);

    expect(response.headers["content-type"]).toContain("application/hal+json");
    expect(response.body).toMatchObject({
      totalActiveDocuments: 2,
      submittedDocuments: 1,
      pendingDocuments: 1,
      percentage: 50
    });
  });

  // STAT-COMP-006
  it("does not add active collaborators without document links to the denominator", async () => {
    await seedLinks(["PENDING"]);
    await httpDatabase()
      .collection("collaborators")
      .insertOne({
        _id: new ObjectId("66a64ab05bd7213b90d9b099"),
        name: "Sem Documento",
        cpf: "99999999999",
        email: "sem-documento@example.com",
        deletedAt: null
      });

    const response = await getStatistics().expect(200);

    expect(response.headers["content-type"]).toContain("application/hal+json");
    expect(response.body).toMatchObject({
      totalActiveDocuments: 1,
      submittedDocuments: 0,
      pendingDocuments: 1,
      percentage: 0
    });
  });

  // STAT-COMP-007
  it("returns a UTC calculation timestamp, semantic ETag, and reporting links", async () => {
    await seedLinks(["SUBMITTED", "PENDING"]);

    const response = await getStatistics().expect(200);
    const body = response.body as CompletenessStatisticsFixture;

    expect(response.headers["content-type"]).toContain("application/hal+json");
    expect(response.headers.etag).toMatch(/^W\/"sha256:[a-f0-9]{64}"$/);
    expect(body.calculatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(new Date(body.calculatedAt).toISOString()).toBe(body.calculatedAt);
    expect(body._links).toEqual({
      self: {href: path},
      "pending-documents": {href: "/api/v1/pending-documents"},
      "pending-document-types": {href: "/api/v1/statistics/pending-document-types"}
    });
  });

  // STAT-COMP-008
  it("returns a bodyless 304 when the semantic ETag is revalidated", async () => {
    await seedLinks(["SUBMITTED", "PENDING"]);
    const first = await getStatistics().expect(200);

    const cached = await getStatistics()
      .set("If-None-Match", first.headers.etag as string)
      .expect(304);

    expect(cached.text).toBe("");
    expect(cached.body).toEqual({});
  });

  // STAT-COMP-009
  it("returns a retryable problem after exceeding the operation rate limit", async () => {
    await seedLinks(["PENDING"]);
    const ip = "198.51.100.26";
    await getStatistics(ip).expect(200);
    await getStatistics(ip).expect(200);

    const response = await getStatistics(ip).expect(429);

    expectProblem(response, "RATE_LIMIT_EXCEEDED");
    expect(Number.parseInt(response.headers["retry-after"] as string, 10)).toBeGreaterThanOrEqual(
      1
    );
  });

  // STAT-COMP-010
  it("sanitizes unexpected reporting failures as an internal problem", async () => {
    const getSpy = vi.spyOn(MongooseService.prototype, "get").mockImplementation(() => {
      throw new Error("database internals must not leak");
    });
    try {
      const response = await getStatistics().expect(500);
      expectProblem(response, "INTERNAL_SERVER_ERROR");
      expect(JSON.stringify(response.body)).not.toMatch(/database internals|stack|node_modules/);
    } finally {
      getSpy.mockRestore();
    }
  });

  // STAT-COMP-011
  it("maps unavailable reporting persistence to a service problem", async () => {
    const getSpy = vi.spyOn(MongooseService.prototype, "get").mockReturnValue(undefined);
    try {
      const response = await getStatistics().expect(503);
      expectProblem(response, "SERVICE_UNAVAILABLE");
    } finally {
      getSpy.mockRestore();
    }
  });
});

function getStatistics(ip?: string) {
  const request = supertest(PlatformTest.callback()).get(path);
  return ip ? request.set("X-Forwarded-For", ip) : request;
}

function expectProblem(
  response: {status: number; headers: Record<string, string>; body: Record<string, unknown>},
  code: string
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
}

async function seedLinks(statuses: readonly ("PENDING" | "SUBMITTED")[]): Promise<void> {
  if (statuses.length === 0) return;
  await httpDatabase()
    .collection("collaborator_documents")
    .insertMany(statuses.map((status, index) => collaboratorDocumentRow(index + 1, status)));
}

function collaboratorDocumentRow(
  offset: number,
  status: "PENDING" | "SUBMITTED",
  overrides: Partial<Document> = {}
): Document {
  const now = new Date("2026-07-31T12:00:00.000Z");
  return {
    _id: new ObjectId(hexadecimalId("66a64ab05bd7213b90d9c000", offset)),
    collaboratorId,
    documentTypeId,
    status,
    currentVersion: status === "SUBMITTED" ? 1 : null,
    versions: status === "SUBMITTED" ? [{version: 1, submittedAt: now}] : [],
    lastSubmittedAt: status === "SUBMITTED" ? now : null,
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
