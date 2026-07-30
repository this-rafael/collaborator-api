import {afterAll, beforeEach, describe, expect, it, vi} from "vitest";
import {MongooseService} from "@tsed/mongoose";
import {ObjectId} from "mongodb";
import supertest from "supertest";
import {PlatformTest} from "@tsed/platform-http/testing";

import {
  activeCollaboratorForLinkFixture,
  activeDocumentTypeForLinkFixture,
  invalidCollaboratorDocumentBodies,
  linkUnlinkedFixture,
  validCollaboratorDocumentBody,
  type CollaboratorDocumentFixture
} from "../helpers/collaborator-document-fixtures.js";
import {resetDatabase} from "../helpers/database.js";
import {bootstrapHttpMongo, httpDatabase} from "../helpers/http-mongo.js";
import {CollaboratorDocumentsRuntime} from "../../src/modules/collaborator-documents/collaborator-documents.runtime.js";

const collaboratorId = activeCollaboratorForLinkFixture().id;
const documentTypeId = activeDocumentTypeForLinkFixture().id;
const otherDocumentTypeId = "66a64ab05bd7213b90d9b011";
const deletedCollaboratorId = "66a64ab05bd7213b90d9b002";
const deletedDocumentTypeId = "66a64ab05bd7213b90d9b012";
const unknownCollaboratorId = "66a64ab05bd7213b90d9b099";
const unknownDocumentTypeId = "66a64ab05bd7213b90d9b098";

describe("Creating collaborator documents", () => {
  bootstrapHttpMongo({
    beforeBootstrap: () => {
      process.env.RATE_LIMIT_WRITE = "20";
      process.env.RATE_LIMIT_WINDOW_MS = "60000";
    }
  });

  beforeEach(async () => {
    await resetDatabase(httpDatabase());
    await seedParents();
    PlatformTest.get<CollaboratorDocumentsRuntime>(
      CollaboratorDocumentsRuntime
    ).resetRateLimiters();
  });

  afterAll(() => {
    delete process.env.RATE_LIMIT_WRITE;
    delete process.env.RATE_LIMIT_WINDOW_MS;
  });

  // LINK-CREATE-001
  it("creates an active PENDING link with Location, ETag, and submit/unlink actions", async () => {
    const response = await create(validCollaboratorDocumentBody()).expect(201);
    const stored = await readById(response.body.id as string);

    expect(response.headers["content-type"]).toContain("application/hal+json");
    expect(response.headers.location).toBe(`/api/v1/collaborator-documents/${response.body.id}`);
    expect(response.headers.etag).toMatch(/^W\/"sha256:[a-f0-9]{64}"$/);
    expect(response.body).toMatchObject({
      collaboratorId,
      documentTypeId,
      status: "PENDING",
      currentVersion: 0,
      lastSubmittedAt: null,
      unlinkedAt: null,
      deletedAt: null
    });
    expect(response.body.linkedAt).toEqual(expect.any(String));
    expect(response.body.createdAt).toEqual(expect.any(String));
    expect(response.body.updatedAt).toEqual(expect.any(String));
    expect(response.body._links).toMatchObject({
      self: {href: response.headers.location},
      collaborator: {href: `/api/v1/collaborators/${collaboratorId}`},
      "document-type": {href: `/api/v1/document-types/${documentTypeId}`},
      versions: {href: `${response.headers.location}/versions`},
      "submit-version": {href: `${response.headers.location}/versions`, method: "POST"},
      unlink: {href: response.headers.location, method: "DELETE"}
    });
    expect(stored).toMatchObject({
      status: "PENDING",
      currentVersion: 0,
      versions: [],
      lastSubmittedAt: null,
      unlinkedAt: null,
      deletedAt: null
    });
  });

  // LINK-CREATE-002
  it("relinks after unlink with a new id, PENDING/v0, and intact prior history", async () => {
    const prior = linkUnlinkedFixture({
      id: "66a64ab05bd7213b90d9c010",
      collaboratorId,
      documentTypeId
    });
    await httpDatabase().collection("collaborator_documents").insertOne(toMongoRow(prior));

    const response = await create(validCollaboratorDocumentBody()).expect(201);
    const previous = await readById(prior.id);
    const created = await readById(response.body.id as string);

    expect(response.body.id).not.toBe(prior.id);
    expect(response.body).toMatchObject({
      status: "PENDING",
      currentVersion: 0,
      lastSubmittedAt: null,
      unlinkedAt: null,
      deletedAt: null
    });
    expect(created?.versions).toEqual([]);
    expect(previous).toMatchObject({
      status: prior.status,
      currentVersion: prior.currentVersion,
      versions: prior.versions,
      unlinkedAt: expect.any(Date)
    });
  });

  // LINK-CREATE-003
  it("allows a second active link for the same collaborator with another document type", async () => {
    await create(validCollaboratorDocumentBody()).expect(201);

    const response = await create(
      validCollaboratorDocumentBody({documentTypeId: otherDocumentTypeId})
    ).expect(201);

    expect(response.body).toMatchObject({
      collaboratorId,
      documentTypeId: otherDocumentTypeId,
      status: "PENDING",
      currentVersion: 0
    });
  });

  // LINK-CREATE-004 / LINK-CREATE-006
  it.each([
    ["collaboratorId", invalidCollaboratorDocumentBodies.missingCollaboratorId],
    ["documentTypeId", invalidCollaboratorDocumentBodies.missingDocumentTypeId]
  ] as const)("rejects a missing %s with field-level validation", async (field, body) => {
    const response = await create(body).expect(422);
    expectProblem(response, "VALIDATION_ERROR", field);
  });

  // LINK-CREATE-005 / LINK-CREATE-007
  it.each([
    ["collaboratorId", invalidCollaboratorDocumentBodies.invalidCollaboratorId],
    ["documentTypeId", invalidCollaboratorDocumentBodies.invalidDocumentTypeId]
  ] as const)("rejects an invalid ObjectId for %s", async (field, body) => {
    const response = await create(body).expect(422);
    expectProblem(response, "VALIDATION_ERROR", field);
  });

  // LINK-CREATE-008
  it("rejects additional properties in the create body", async () => {
    const response = await create(invalidCollaboratorDocumentBodies.extraProperty).expect(422);
    expectProblem(response, "VALIDATION_ERROR");
  });

  // LINK-CREATE-009
  it("rejects malformed JSON without persisting a link", async () => {
    const before = await countLinks();
    const response = await createRaw('{"collaboratorId":').expect(400);
    expectProblem(response, "MALFORMED_JSON");
    expect(await countLinks()).toBe(before);
  });

  // LINK-CREATE-010
  it("rejects an unsupported Content-Type without persisting a link", async () => {
    const before = await countLinks();
    const response = await supertest(PlatformTest.callback())
      .post("/api/v1/collaborator-documents")
      .set("Content-Type", "text/plain")
      .send("collaboratorId=x")
      .expect(415);
    expectProblem(response, "UNSUPPORTED_MEDIA_TYPE");
    expect(await countLinks()).toBe(before);
  });

  // LINK-CREATE-011
  it("maps a missing collaborator to 404 without a partial write", async () => {
    const before = await countLinks();
    const response = await create(
      validCollaboratorDocumentBody({collaboratorId: unknownCollaboratorId})
    ).expect(404);
    expectProblem(response, "COLLABORATOR_NOT_FOUND");
    expect(await countLinks()).toBe(before);
  });

  // LINK-CREATE-012
  it("maps a missing document type to 404 without a partial write", async () => {
    const before = await countLinks();
    const response = await create(
      validCollaboratorDocumentBody({documentTypeId: unknownDocumentTypeId})
    ).expect(404);
    expectProblem(response, "DOCUMENT_TYPE_NOT_FOUND");
    expect(await countLinks()).toBe(before);
  });

  // LINK-CREATE-013
  it("rejects a duplicate active collaborator/document-type pair", async () => {
    await create(validCollaboratorDocumentBody()).expect(201);
    const before = await countLinks();

    const response = await create(validCollaboratorDocumentBody()).expect(409);
    expectProblem(response, "ACTIVE_LINK_ALREADY_EXISTS");
    expect(await countLinks()).toBe(before);
  });

  // LINK-CREATE-014
  it("maps a soft-deleted collaborator to 410 without a partial write", async () => {
    const before = await countLinks();
    const response = await create(
      validCollaboratorDocumentBody({collaboratorId: deletedCollaboratorId})
    ).expect(410);
    expectProblem(response, "COLLABORATOR_DELETED");
    expect(await countLinks()).toBe(before);
  });

  // LINK-CREATE-015
  it("maps a soft-deleted document type to 410 without a partial write", async () => {
    const before = await countLinks();
    const response = await create(
      validCollaboratorDocumentBody({documentTypeId: deletedDocumentTypeId})
    ).expect(410);
    expectProblem(response, "DOCUMENT_TYPE_DELETED");
    expect(await countLinks()).toBe(before);
  });

  // LINK-CREATE-016
  it("returns 429 with Retry-After after the write limit is exceeded", async () => {
    const ip = "198.51.100.18";
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await create(
        validCollaboratorDocumentBody({
          documentTypeId: otherDocumentTypeId
        }),
        ip
      );
    }

    const response = await create(validCollaboratorDocumentBody(), ip).expect(429);
    expectProblem(response, "RATE_LIMIT_EXCEEDED");
    expect(Number.parseInt(response.headers["retry-after"] as string, 10)).toBeGreaterThanOrEqual(
      1
    );
  });

  // LINK-CREATE-017
  it("sanitizes unexpected persistence failures as 500", async () => {
    const {MongoCollaboratorDocumentRepository} =
      await import("../../src/modules/collaborator-documents/infrastructure/persistence/mongodb/collaborator-document.mongo-repository.js");
    const {err} = await import("neverthrow");
    const createSpy = vi
      .spyOn(MongoCollaboratorDocumentRepository.prototype, "create")
      .mockResolvedValue(
        err({
          kind: "application",
          code: "INTERNAL_SERVER_ERROR",
          message: "database internals must not leak"
        })
      );
    try {
      const response = await create(validCollaboratorDocumentBody()).expect(500);
      expectProblem(response, "INTERNAL_SERVER_ERROR");
      expect(JSON.stringify(response.body)).not.toMatch(/database internals|stack|node_modules/);
    } finally {
      createSpy.mockRestore();
    }
  });

  // LINK-CREATE-018
  it("sanitizes unavailable persistence as 503", async () => {
    const getSpy = vi.spyOn(MongooseService.prototype, "get").mockReturnValue(undefined);
    try {
      const response = await create(validCollaboratorDocumentBody()).expect(503);
      expectProblem(response, "SERVICE_UNAVAILABLE");
      expect(response.body.traceId).toEqual(expect.any(String));
    } finally {
      getSpy.mockRestore();
    }
  });
});

function create(body: Record<string, unknown>, ip?: string) {
  const request = supertest(PlatformTest.callback())
    .post("/api/v1/collaborator-documents")
    .send(body);
  return ip ? request.set("X-Forwarded-For", ip) : request;
}

function createRaw(body: string) {
  return supertest(PlatformTest.callback())
    .post("/api/v1/collaborator-documents")
    .set("Content-Type", "application/json")
    .send(body);
}

async function seedParents(): Promise<void> {
  const now = new Date("2026-07-30T12:00:00.000Z");
  await httpDatabase()
    .collection("collaborators")
    .insertMany([
      {
        _id: new ObjectId(collaboratorId),
        name: "Ana Silva",
        nameNormalized: "ana silva",
        cpf: "12345678909",
        email: "ana@example.com",
        deletedAt: null,
        createdAt: now,
        updatedAt: now
      },
      {
        _id: new ObjectId(deletedCollaboratorId),
        name: "Ana Removida",
        nameNormalized: "ana removida",
        cpf: "98765432100",
        email: "removed@example.com",
        deletedAt: now,
        createdAt: now,
        updatedAt: now
      }
    ]);
  await httpDatabase()
    .collection("document_types")
    .insertMany([
      {
        _id: new ObjectId(documentTypeId),
        name: "Atestado de Saúde Ocupacional",
        code: "ASO",
        description: null,
        deletedAt: null,
        createdAt: now,
        updatedAt: now
      },
      {
        _id: new ObjectId(otherDocumentTypeId),
        name: "Exame Admissional",
        code: "ADM",
        description: null,
        deletedAt: null,
        createdAt: now,
        updatedAt: now
      },
      {
        _id: new ObjectId(deletedDocumentTypeId),
        name: "Tipo Removido",
        code: "OLD",
        description: null,
        deletedAt: now,
        createdAt: now,
        updatedAt: now
      }
    ]);
}

async function readById(id: string) {
  return httpDatabase()
    .collection("collaborator_documents")
    .findOne({_id: new ObjectId(id)});
}

async function countLinks(): Promise<number> {
  return httpDatabase().collection("collaborator_documents").countDocuments();
}

function toMongoRow(fixture: CollaboratorDocumentFixture) {
  return {
    _id: new ObjectId(fixture.id),
    collaboratorId: fixture.collaboratorId,
    documentTypeId: fixture.documentTypeId,
    status: fixture.status,
    currentVersion: fixture.currentVersion,
    versions: fixture.versions,
    lastSubmittedAt: fixture.lastSubmittedAt ? new Date(fixture.lastSubmittedAt) : null,
    linkedAt: new Date(fixture.linkedAt),
    unlinkedAt: fixture.unlinkedAt ? new Date(fixture.unlinkedAt) : null,
    createdAt: new Date(fixture.createdAt),
    updatedAt: new Date(fixture.updatedAt),
    deletedAt: fixture.deletedAt ? new Date(fixture.deletedAt) : null
  };
}

function expectProblem(
  response: {headers: Record<string, string>; body: Record<string, unknown>},
  code: string,
  field?: string
): void {
  expect(response.headers["content-type"]).toContain("application/problem+json");
  expect(response.body).toMatchObject({code, status: response.body.status});
  expect(response.body.traceId).toEqual(expect.any(String));
  for (const key of ["type", "title", "detail", "instance"]) {
    expect(response.body[key]).toBeDefined();
  }
  if (field)
    expect(response.body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({field})])
    );
}
