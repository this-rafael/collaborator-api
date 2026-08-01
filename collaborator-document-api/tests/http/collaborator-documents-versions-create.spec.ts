import {afterAll, beforeEach, describe, expect, it, vi} from "vitest";
import {MongooseService} from "@tsed/mongoose";
import {ObjectId} from "mongodb";
import {err} from "neverthrow";
import supertest from "supertest";
import {PlatformTest} from "@tsed/platform-http/testing";

import {
  boundaryDocumentVersionBodies,
  documentVersionFixture,
  documentVersionMetadataFixture,
  invalidDocumentVersionBodies,
  linkDeletedFixture,
  linkPendingFixture,
  linkSubmittedFixture,
  linkUnlinkedFixture,
  minimalDocumentVersionBody,
  nullDocumentVersionBody,
  validDocumentVersionBody,
  type CollaboratorDocumentFixture,
  type DocumentVersionFixture
} from "../helpers/collaborator-document-fixtures.js";
import {resetDatabase} from "../helpers/database.js";
import {bootstrapHttpMongo, httpDatabase} from "../helpers/http-mongo.js";
import {CollaboratorDocumentsRuntime} from "../../src/modules/collaborator-documents/collaborator-documents.runtime.js";

const pendingId = "66a64ab05bd7213b90d9c001";
const submittedId = "66a64ab05bd7213b90d9c002";
const unlinkedId = "66a64ab05bd7213b90d9c003";
const deletedId = "66a64ab05bd7213b90d9c004";
const unknownId = "66a64ab05bd7213b90d9c099";

describe("Creating collaborator document versions", () => {
  bootstrapHttpMongo({
    beforeBootstrap: () => {
      process.env.RATE_LIMIT_WRITE = "20";
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
    delete process.env.RATE_LIMIT_WRITE;
    delete process.env.RATE_LIMIT_WINDOW_MS;
  });

  // VER-CREATE-001
  it("creates the first submitted version and updates the document state", async () => {
    const response = await submit(validDocumentVersionBody()).expect(201);
    const stored = await read(pendingId);

    expect(response.headers["content-type"]).toContain("application/hal+json");
    expect(response.headers.location).toBe(
      `/api/v1/collaborator-documents/${pendingId}/versions/1`
    );
    expect(response.body).toMatchObject({
      version: 1,
      submittedAt: expect.any(String),
      _links: {
        self: {href: response.headers.location},
        document: {href: `/api/v1/collaborator-documents/${pendingId}`}
      }
    });
    expect(stored).toMatchObject({
      status: "SUBMITTED",
      currentVersion: 1,
      versions: [expect.objectContaining({version: 1})],
      lastSubmittedAt: expect.any(Date),
      updatedAt: expect.any(Date)
    });
  });

  // VER-CREATE-002
  it("appends a new version while preserving the previous history", async () => {
    const before = await read(submittedId);
    const response = await submit(validDocumentVersionBody(), submittedId).expect(201);
    const after = await read(submittedId);

    expect(response.headers["content-type"]).toContain("application/hal+json");
    expect(response.body.version).toBe(2);
    expect(after).toMatchObject({
      status: "SUBMITTED",
      currentVersion: 2,
      lastSubmittedAt: expect.any(Date)
    });
    expect(after?.versions).toHaveLength(2);
    expect(after?.versions[0]).toEqual(before?.versions[0]);
    expect(after?.versions[1]).toMatchObject({version: 2});
  });

  // VER-CREATE-003
  it("persists every logical metadata field exactly as submitted", async () => {
    const body = validDocumentVersionBody();
    const response = await submit(body).expect(201);
    const stored = await read(pendingId);

    expect(response.body.metadata).toEqual(body.metadata);
    expect(stored?.versions[0]).toMatchObject({metadata: body.metadata});
  });

  // VER-CREATE-004
  it("stores omitted optional metadata fields as null", async () => {
    const response = await submit(minimalDocumentVersionBody()).expect(201);
    const stored = await read(pendingId);
    const metadata = {
      originalName: "aso.pdf",
      mimeType: null,
      sizeBytes: null,
      storageKey: null,
      notes: null
    };

    expect(response.body.metadata).toEqual(metadata);
    expect(stored?.versions[0]).toMatchObject({metadata});
  });

  // VER-CREATE-005
  it("accepts explicitly null optional metadata fields", async () => {
    const body = nullDocumentVersionBody();
    const response = await submit(body).expect(201);

    expect(response.body.metadata).toEqual(body.metadata);
    expect((await read(pendingId))?.versions[0]).toMatchObject({metadata: body.metadata});
  });

  // VER-CREATE-006
  it("serializes simultaneous submissions into distinct sequential versions", async () => {
    const [first, second] = await Promise.all([
      submit(validDocumentVersionBody({notes: "primeiro envio"})),
      submit(validDocumentVersionBody({notes: "segundo envio"}))
    ]);
    const stored = await read(pendingId);

    expect([first.status, second.status]).toEqual([201, 201]);
    expect([first.body.version, second.body.version].sort()).toEqual([1, 2]);
    expect(stored).toMatchObject({status: "SUBMITTED", currentVersion: 2});
    expect(stored?.versions.map((version: {version: number}) => version.version)).toEqual([1, 2]);
  });

  // VER-CREATE-007
  it("rejects a body without metadata", async () => {
    const response = await submit(invalidDocumentVersionBodies.missingMetadata).expect(422);
    expectProblem(response, "VALIDATION_ERROR", "metadata");
  });

  // VER-CREATE-008
  it.each([
    ["null", null],
    ["text", "metadata"],
    ["a number", 42],
    ["a boolean", true],
    ["an array", []]
  ])("rejects metadata when it is %s", async (_description, metadata) => {
    const response = await submit({metadata}).expect(422);
    expectProblem(response, "VALIDATION_ERROR", "metadata");
  });

  // VER-CREATE-009
  it("rejects metadata without an original file name", async () => {
    const response = await submit(invalidDocumentVersionBodies.missingOriginalName).expect(422);
    expectProblem(response, "VALIDATION_ERROR", "metadata.originalName");
  });

  // VER-CREATE-010
  it("rejects an empty original file name", async () => {
    const response = await submit(invalidDocumentVersionBodies.emptyOriginalName).expect(422);
    expectProblem(response, "VALIDATION_ERROR", "metadata.originalName");
  });

  // VER-CREATE-011
  it("rejects an original file name longer than 512 characters", async () => {
    const response = await submit(invalidDocumentVersionBodies.longOriginalName).expect(422);
    expectProblem(response, "VALIDATION_ERROR", "metadata.originalName");
  });

  // VER-CREATE-012
  it("rejects a non-textual original file name", async () => {
    const response = await submit(invalidDocumentVersionBodies.nonTextOriginalName).expect(422);
    expectProblem(response, "VALIDATION_ERROR", "metadata.originalName");
  });

  // VER-CREATE-013
  it("rejects a media type longer than 255 characters", async () => {
    const response = await submit(invalidDocumentVersionBodies.longMimeType).expect(422);
    expectProblem(response, "VALIDATION_ERROR", "metadata.mimeType");
  });

  // VER-CREATE-014
  it("rejects a media type that is neither text nor null", async () => {
    const response = await submit(invalidDocumentVersionBodies.nonTextMimeType).expect(422);
    expectProblem(response, "VALIDATION_ERROR", "metadata.mimeType");
  });

  // VER-CREATE-015
  it("rejects a negative file size", async () => {
    const response = await submit(invalidDocumentVersionBodies.negativeSizeBytes).expect(422);
    expectProblem(response, "VALIDATION_ERROR", "metadata.sizeBytes");
  });

  // VER-CREATE-016
  it.each([
    ["a decimal", 1.5],
    ["text", "1"],
    ["a boolean", true],
    ["an array", []],
    ["an object", {}]
  ])("rejects a file size represented by %s", async (_description, sizeBytes) => {
    const response = await submit({
      metadata: {...documentVersionMetadataFixture(), sizeBytes}
    }).expect(422);
    expectProblem(response, "VALIDATION_ERROR", "metadata.sizeBytes");
  });

  // VER-CREATE-017
  it("rejects a storage key longer than 1024 characters", async () => {
    const response = await submit(invalidDocumentVersionBodies.longStorageKey).expect(422);
    expectProblem(response, "VALIDATION_ERROR", "metadata.storageKey");
  });

  // VER-CREATE-018
  it("rejects a storage key that is neither text nor null", async () => {
    const response = await submit(invalidDocumentVersionBodies.nonTextStorageKey).expect(422);
    expectProblem(response, "VALIDATION_ERROR", "metadata.storageKey");
  });

  // VER-CREATE-019
  it("rejects notes longer than 4000 characters", async () => {
    const response = await submit(invalidDocumentVersionBodies.longNotes).expect(422);
    expectProblem(response, "VALIDATION_ERROR", "metadata.notes");
  });

  // VER-CREATE-020
  it("rejects notes that are neither text nor null", async () => {
    const response = await submit(invalidDocumentVersionBodies.nonTextNotes).expect(422);
    expectProblem(response, "VALIDATION_ERROR", "metadata.notes");
  });

  // VER-CREATE-021
  it.each([
    ["the minimum original file name", boundaryDocumentVersionBodies.minimumOriginalName],
    ["all maximum field lengths", boundaryDocumentVersionBodies.maximumFields]
  ])("accepts metadata at %s", async (_description, body) => {
    const response = await submit(body).expect(201);
    expect(response.headers["content-type"]).toContain("application/hal+json");
  });

  // VER-CREATE-022
  it("rejects an additional property in the request body", async () => {
    const response = await submit(invalidDocumentVersionBodies.additionalBodyProperty).expect(422);
    expectProblem(response, "VALIDATION_ERROR", "unexpected");
  });

  // VER-CREATE-023
  it("rejects an additional property in metadata", async () => {
    const response = await submit(invalidDocumentVersionBodies.additionalMetadataProperty).expect(
      422
    );
    expectProblem(response, "VALIDATION_ERROR", "metadata.unexpected");
  });

  // VER-CREATE-024
  it("rejects a malformed document identifier", async () => {
    const response = await submit(validDocumentVersionBody(), "not-an-object-id").expect(400);
    expectProblem(response, "INVALID_OBJECT_ID", "id");
  });

  // VER-CREATE-025
  it("rejects an unsupported request media type without changing the document", async () => {
    const before = await read(pendingId);
    const response = await supertest(PlatformTest.callback())
      .post(`/api/v1/collaborator-documents/${pendingId}/versions`)
      .set("Content-Type", "text/plain")
      .send("originalName=aso.pdf")
      .expect(415);

    expectProblem(response, "UNSUPPORTED_MEDIA_TYPE");
    expect(await read(pendingId)).toEqual(before);
  });

  // VER-CREATE-026
  it("returns not found without a partial change for an unknown document", async () => {
    const before = await countDocuments();
    const response = await submit(validDocumentVersionBody(), unknownId).expect(404);

    expectProblem(response, "COLLABORATOR_DOCUMENT_NOT_FOUND");
    expect(await countDocuments()).toBe(before);
  });

  // VER-CREATE-027
  it("rejects submission to an unlinked document without changing its history", async () => {
    const before = await read(unlinkedId);
    const response = await submit(validDocumentVersionBody(), unlinkedId).expect(410);

    expectProblem(response, "COLLABORATOR_DOCUMENT_UNLINKED");
    expect(await read(unlinkedId)).toEqual(before);
  });

  // VER-CREATE-028
  it("rejects submission to a cascade-deleted document without changing it", async () => {
    const before = await read(deletedId);
    const response = await submit(validDocumentVersionBody(), deletedId).expect(410);

    expectProblem(response, "COLLABORATOR_DOCUMENT_DELETED");
    expect(await read(deletedId)).toEqual(before);
  });

  // VER-CREATE-029
  it("returns a retry delay after the write operation limit is exceeded", async () => {
    const ip = "198.51.100.22";
    const accepted = [];
    for (let attempt = 0; attempt < 20; attempt += 1) {
      accepted.push(await submit(validDocumentVersionBody(), pendingId, ip));
    }
    expect(accepted.map((response) => response.status)).toEqual(Array(20).fill(201));

    const response = await submit(validDocumentVersionBody(), pendingId, ip).expect(429);
    expectProblem(response, "RATE_LIMIT_EXCEEDED");
    expect(Number.parseInt(response.headers["retry-after"] as string, 10)).toBeGreaterThanOrEqual(
      1
    );
  });

  // VER-CREATE-030
  it("sanitizes an unexpected persistence failure", async () => {
    const {MongoCollaboratorDocumentRepository} =
      await import("../../src/modules/collaborator-documents/infrastructure/persistence/mongodb/collaborator-document.mongo-repository.js");
    const appendSpy = vi
      .spyOn(MongoCollaboratorDocumentRepository.prototype, "appendVersion" as never)
      .mockResolvedValue(
        err({
          kind: "application",
          code: "INTERNAL_SERVER_ERROR",
          message: "database internals must not leak"
        }) as never
      );
    try {
      const response = await submit(validDocumentVersionBody()).expect(500);
      expectProblem(response, "INTERNAL_SERVER_ERROR");
      expect(JSON.stringify(response.body)).not.toMatch(/database internals|stack|node_modules/);
    } finally {
      appendSpy.mockRestore();
    }
  });

  // VER-CREATE-031
  it("returns a sanitized service unavailable response when persistence is down", async () => {
    const getSpy = vi.spyOn(MongooseService.prototype, "get").mockReturnValue(undefined);
    try {
      const response = await submit(validDocumentVersionBody()).expect(503);
      expectProblem(response, "SERVICE_UNAVAILABLE");
    } finally {
      getSpy.mockRestore();
    }
  });

  // VER-CREATE-032
  it("creates another version when an accepted request is retried with identical metadata", async () => {
    const body = validDocumentVersionBody();
    const uncertainResponse = await submit(body).expect(201);
    const retryResponse = await submit(body).expect(201);
    const stored = await read(pendingId);

    expect(uncertainResponse.body.version).toBe(1);
    expect(retryResponse.body.version).toBe(2);
    expect(stored?.versions).toHaveLength(2);
    expect(stored?.versions.map((version: {metadata: unknown}) => version.metadata)).toEqual([
      body.metadata,
      body.metadata
    ]);
  });

  // VER-CREATE-033
  it("maps an exhausted embedded history to 422 without truncating confirmed state", async () => {
    const {MongoCollaboratorDocumentRepository} =
      await import("../../src/modules/collaborator-documents/infrastructure/persistence/mongodb/collaborator-document.mongo-repository.js");
    const appendSpy = vi
      .spyOn(MongoCollaboratorDocumentRepository.prototype, "appendVersion" as never)
      .mockResolvedValue(
        err({
          kind: "application",
          code: "DOCUMENT_HISTORY_LIMIT_REACHED",
          message: "embedded history reached physical capacity"
        }) as never
      );
    const before = await read(submittedId);
    try {
      const response = await submit(validDocumentVersionBody(), submittedId).expect(422);
      expectProblem(response, "DOCUMENT_HISTORY_LIMIT_REACHED");
      expect(await read(submittedId)).toEqual(before);
    } finally {
      appendSpy.mockRestore();
    }
  });
});

function submit(body: object, id = pendingId, ip?: string) {
  const request = supertest(PlatformTest.callback())
    .post(`/api/v1/collaborator-documents/${id}/versions`)
    .send(body);
  return ip ? request.set("X-Forwarded-For", ip) : request;
}

async function seedDocuments(): Promise<void> {
  await httpDatabase()
    .collection("collaborator_documents")
    .insertMany(
      [
        linkPendingFixture({id: pendingId}),
        linkSubmittedFixture({
          id: submittedId,
          versions: [documentVersionFixture()],
          documentTypeId: "66a64ab05bd7213b90d9b011"
        }),
        linkUnlinkedFixture({
          id: unlinkedId,
          versions: [documentVersionFixture()],
          documentTypeId: "66a64ab05bd7213b90d9b012"
        }),
        linkDeletedFixture({
          id: deletedId,
          versions: [],
          documentTypeId: "66a64ab05bd7213b90d9b013"
        })
      ].map(toMongoRow)
    );
}

async function read(id: string) {
  return httpDatabase()
    .collection("collaborator_documents")
    .findOne({_id: new ObjectId(id)});
}

async function countDocuments(): Promise<number> {
  return httpDatabase().collection("collaborator_documents").countDocuments();
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

function expectProblem(
  response: {headers: Record<string, string>; body: Record<string, unknown>},
  code: string,
  field?: string
): void {
  expect(response.headers["content-type"]).toContain("application/problem+json");
  expect(response.body).toMatchObject({code, status: response.body.status});
  expect(response.body.traceId).toEqual(expect.any(String));
  for (const key of ["type", "title", "status", "detail", "instance"]) {
    expect(response.body[key]).toBeDefined();
  }
  if (field) {
    expect(response.body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({field})])
    );
  }
}
