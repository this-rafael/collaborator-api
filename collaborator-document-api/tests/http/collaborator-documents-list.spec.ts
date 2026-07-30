import {afterAll, beforeEach, describe, expect, it, vi} from "vitest";
import {MongooseService} from "@tsed/mongoose";
import {ObjectId} from "mongodb";
import supertest from "supertest";
import {PlatformTest} from "@tsed/platform-http/testing";

import {cursorClock, cursorSecret} from "../helpers/cursor-runtime.js";
import {
  collaboratorDocumentPageFixtures,
  linkDeletedFixture,
  linkPendingFixture,
  linkSubmittedFixture,
  linkUnlinkedFixture,
  type CollaboratorDocumentFixture
} from "../helpers/collaborator-document-fixtures.js";
import {resetDatabase} from "../helpers/database.js";
import {bootstrapHttpMongo, httpDatabase} from "../helpers/http-mongo.js";

const collaboratorOne = "66a64ab05bd7213b90d9b001";
const collaboratorTwo = "66a64ab05bd7213b90d9b002";
const typeOne = "66a64ab05bd7213b90d9b010";
const typeTwo = "66a64ab05bd7213b90d9b011";

describe("Listing collaborator documents", () => {
  bootstrapHttpMongo({
    beforeBootstrap: () => {
      process.env.RATE_LIMIT_GET = "1";
      process.env.RATE_LIMIT_WINDOW_MS = "60000";
    }
  });

  beforeEach(async () => {
    await resetDatabase(httpDatabase());
    await seedBaseLinks();
  });

  afterAll(() => {
    delete process.env.RATE_LIMIT_GET;
    delete process.env.RATE_LIMIT_WINDOW_MS;
  });

  it("returns only active links by default with HAL and ETag", async () => {
    const response = await list().expect(200);
    const items = collectionItems(response.body);

    expect(response.headers["content-type"]).toContain("application/hal+json");
    expect(response.headers.etag).toMatch(/^W\/("sha256:[a-f0-9]{64}")$/);
    expect(items.map((item) => item.id).sort()).toEqual(
      ["66a64ab05bd7213b90d9c001", "66a64ab05bd7213b90d9c002", "66a64ab05bd7213b90d9c004"].sort()
    );
    expect(items.every((item) => item.deletedAt === null && item.unlinkedAt === null)).toBe(true);
  });

  it("returns an empty HAL collection when no link matches", async () => {
    const response = await list({collaboratorId: "66a64ab05bd7213b90d9b099"}).expect(200);

    expect(response.body.count).toBe(0);
    expect(collectionItems(response.body)).toEqual([]);
  });

  it("filters by collaborator and document type", async () => {
    const byCollaborator = await list({collaboratorId: collaboratorTwo, lifecycle: "all"}).expect(
      200
    );
    expect(collectionItems(byCollaborator.body).map((item) => item.collaboratorId)).toEqual(
      expect.arrayContaining([collaboratorTwo])
    );
    expect(
      collectionItems(byCollaborator.body).every((item) => item.collaboratorId === collaboratorTwo)
    ).toBe(true);

    const byType = await list({documentTypeId: typeTwo, lifecycle: "all"}).expect(200);
    expect(collectionItems(byType.body).every((item) => item.documentTypeId === typeTwo)).toBe(
      true
    );
  });

  it.each(["PENDING", "SUBMITTED"] as const)(
    "filters active links by status=%s",
    async (status) => {
      const response = await list({status}).expect(200);
      expect(collectionItems(response.body).every((item) => item.status === status)).toBe(true);
      expect(
        collectionItems(response.body).every(
          (item) => item.deletedAt === null && item.unlinkedAt === null
        )
      ).toBe(true);
    }
  );

  it.each([
    [
      "active",
      ["66a64ab05bd7213b90d9c001", "66a64ab05bd7213b90d9c002", "66a64ab05bd7213b90d9c004"]
    ],
    ["unlinked", ["66a64ab05bd7213b90d9c005"]],
    ["deleted", ["66a64ab05bd7213b90d9c006", "66a64ab05bd7213b90d9c007"]],
    [
      "all",
      [
        "66a64ab05bd7213b90d9c001",
        "66a64ab05bd7213b90d9c002",
        "66a64ab05bd7213b90d9c004",
        "66a64ab05bd7213b90d9c005",
        "66a64ab05bd7213b90d9c006",
        "66a64ab05bd7213b90d9c007"
      ]
    ]
  ])("filters lifecycle=%s without duplicates", async (lifecycle, expectedIds) => {
    const response = await list({lifecycle}).expect(200);
    expect(
      collectionItems(response.body)
        .map((item) => item.id)
        .sort()
    ).toEqual((expectedIds as string[]).sort());
    expect(new Set(collectionItems(response.body).map((item) => item.id)).size).toBe(
      collectionItems(response.body).length
    );
  });

  it("combines collaborator, type, status, and lifecycle filters with AND", async () => {
    const response = await list({
      collaboratorId: collaboratorOne,
      documentTypeId: typeTwo,
      status: "PENDING",
      lifecycle: "deleted"
    }).expect(200);

    expect(collectionItems(response.body).map((item) => item.id)).toEqual([
      "66a64ab05bd7213b90d9c007"
    ]);
  });

  it("classifies a link with both timestamps as deleted", async () => {
    const [active, unlinked, deleted, all] = await Promise.all([
      list({lifecycle: "active"}).expect(200),
      list({lifecycle: "unlinked"}).expect(200),
      list({lifecycle: "deleted"}).expect(200),
      list({lifecycle: "all"}).expect(200)
    ]);

    expect(collectionItems(active.body).map((item) => item.id)).not.toContain(
      "66a64ab05bd7213b90d9c007"
    );
    expect(collectionItems(unlinked.body).map((item) => item.id)).not.toContain(
      "66a64ab05bd7213b90d9c007"
    );
    expect(collectionItems(deleted.body).map((item) => item.id)).toContain(
      "66a64ab05bd7213b90d9c007"
    );
    expect(
      collectionItems(all.body).filter((item) => item.id === "66a64ab05bd7213b90d9c007")
    ).toHaveLength(1);
  });

  it.each([
    ["collaboratorId", "not-an-object-id"],
    ["documentTypeId", "not-an-object-id"],
    ["status", "INVALID"],
    ["lifecycle", "INVALID"]
  ])("rejects invalid %s query parameters", async (field, value) => {
    const response = await list({[field]: value}).expect(400);
    expectProblem(response, "INVALID_QUERY_PARAMETER", field);
  });

  it("uses a default limit of 20 and publishes self", async () => {
    await resetDatabase(httpDatabase());
    await seedLinks(collaboratorDocumentPageFixtures(25));
    const response = await list().expect(200);

    expect(collectionItems(response.body).length).toBeLessThanOrEqual(20);
    expect(response.body._links.self.href).toContain("limit=20");
  });

  it.each([1, 100])("honors the pagination boundary limit=%s", async (limit) => {
    await resetDatabase(httpDatabase());
    await seedLinks(collaboratorDocumentPageFixtures(101));
    const response = await list({limit}).expect(200);

    expect(collectionItems(response.body).length).toBe(Math.min(limit, 101));
  });

  it("continues with the opaque next cursor without duplicates or omissions", async () => {
    await resetDatabase(httpDatabase());
    await seedLinks(collaboratorDocumentPageFixtures(3));
    const first = await list({limit: 1}).expect(200);
    const second = await supertest(PlatformTest.callback())
      .get(first.body._links.next.href as string)
      .expect(200);

    const firstId = collectionItems(first.body)[0]!.id;
    const secondId = collectionItems(second.body)[0]!.id;
    expect(secondId).not.toBe(firstId);
    expect(
      typeof new URL(first.body._links.next.href as string, "http://localhost").searchParams.get(
        "cursor"
      )
    ).toBe("string");
  });

  it.each([
    ["cursor", ""],
    ["limit", "0"],
    ["limit", "101"],
    ["limit", "not-an-integer"]
  ])("rejects invalid pagination parameter %s=%s", async (field, value) => {
    const response = await list({[field]: value}).expect(400);
    expectProblem(response, "INVALID_QUERY_PARAMETER", field);
  });

  it("rejects tampered, expired, and context-incompatible cursors without partial pages", async () => {
    await resetDatabase(httpDatabase());
    await seedLinks(collaboratorDocumentPageFixtures(3));
    const first = await list({limit: 1}).expect(200);
    const nextUrl = new URL(first.body._links.next.href as string, "http://localhost");
    const validCursor = nextUrl.searchParams.get("cursor");

    const tampered = await list({cursor: `${validCursor}tampered`, limit: 1}).expect(400);
    expectProblem(tampered, "INVALID_QUERY_PARAMETER", "cursor");

    const expiredCodec =
      await import("../../src/shared/infrastructure/security/hmac-cursor-codec.js");
    const expired = new expiredCodec.HmacCursorCodec(cursorSecret, cursorClock()).encode({
      operationId: "listCollaboratorDocuments",
      filtersHash: "expired",
      order: "_id:asc",
      limit: 1,
      position: {id: "66a64ab05bd7213b90d9d001"}
    });
    const expiredResponse = await list({cursor: expired, limit: 1}).expect(400);
    expectProblem(expiredResponse, "INVALID_QUERY_PARAMETER", "cursor");

    nextUrl.searchParams.set("limit", "2");
    const incompatible = await supertest(PlatformTest.callback())
      .get(`${nextUrl.pathname}${nextUrl.search}`)
      .expect(400);
    expectProblem(incompatible, "INVALID_QUERY_PARAMETER", "cursor");
  });

  it("returns 304 without a body for a matching ETag", async () => {
    const first = await list().expect(200);
    const second = await list()
      .set("If-None-Match", first.headers.etag as string)
      .expect(304);

    expect(second.text).toBe("");
    expect(second.body).toEqual({});
  });

  it("returns 429 with Retry-After when the GET operation limit is exceeded", async () => {
    await list().expect(200);
    const response = await list().expect(429);

    expect(response.headers["content-type"]).toContain("application/problem+json");
    expect(Number.parseInt(response.headers["retry-after"] as string, 10)).toBeGreaterThanOrEqual(
      1
    );
    expect(response.body).toMatchObject({status: 429, code: "RATE_LIMIT_EXCEEDED"});
  });

  it("sanitizes unexpected persistence failures as 500", async () => {
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

  it("sanitizes unavailable persistence as 503", async () => {
    const getSpy = vi.spyOn(MongooseService.prototype, "get").mockReturnValue(undefined);
    try {
      const response = await list().expect(503);
      expectProblem(response, "SERVICE_UNAVAILABLE");
      expect(response.body.traceId).toEqual(expect.any(String));
    } finally {
      getSpy.mockRestore();
    }
  });
});

function list(query: Record<string, string | number> = {}) {
  return supertest(PlatformTest.callback()).get("/api/v1/collaborator-documents").query(query);
}

type CollectionItem = {
  id: string;
  collaboratorId: string;
  documentTypeId: string;
  status: string;
  deletedAt: string | null;
  unlinkedAt: string | null;
};

function collectionItems(body: Record<string, unknown>): CollectionItem[] {
  const embedded = body._embedded;
  if (!embedded || typeof embedded !== "object" || Array.isArray(embedded)) return [];
  const items = (embedded as Record<string, unknown>)["collaborator-documents"];
  if (!Array.isArray(items)) return [];
  return items as CollectionItem[];
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

async function seedBaseLinks(): Promise<void> {
  await seedLinks([
    linkPendingFixture({
      id: "66a64ab05bd7213b90d9c001",
      collaboratorId: collaboratorOne,
      documentTypeId: typeOne
    }),
    linkSubmittedFixture({
      id: "66a64ab05bd7213b90d9c002",
      collaboratorId: collaboratorOne,
      documentTypeId: typeTwo
    }),
    linkPendingFixture({
      id: "66a64ab05bd7213b90d9c004",
      collaboratorId: collaboratorTwo,
      documentTypeId: typeOne
    }),
    linkUnlinkedFixture({
      id: "66a64ab05bd7213b90d9c005",
      collaboratorId: collaboratorTwo,
      documentTypeId: typeTwo
    }),
    linkDeletedFixture({
      id: "66a64ab05bd7213b90d9c006",
      collaboratorId: collaboratorOne,
      documentTypeId: typeOne
    }),
    linkDeletedFixture({
      id: "66a64ab05bd7213b90d9c007",
      collaboratorId: collaboratorOne,
      documentTypeId: typeTwo,
      unlinkedAt: "2026-07-30T13:30:00.000Z"
    })
  ]);
}

async function seedLinks(fixtures: CollaboratorDocumentFixture[]): Promise<void> {
  if (fixtures.length > 0)
    await httpDatabase().collection("collaborator_documents").insertMany(fixtures.map(toMongoRow));
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
