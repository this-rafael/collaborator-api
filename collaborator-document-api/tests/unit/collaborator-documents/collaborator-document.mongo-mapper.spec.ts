import {describe, expect, it} from "vitest";
import type {Result} from "neverthrow";

import {CollaboratorDocument} from "../../../src/modules/collaborator-documents/domain/aggregates/collaborator-document.js";
import {
  collaboratorDocumentFromMongoDocument,
  collaboratorDocumentOutputFromMongoDocument,
  collaboratorDocumentToMongoDocument
} from "../../../src/modules/collaborator-documents/infrastructure/persistence/mongodb/collaborator-document.mongo-mapper.js";

const id = "66a64ab05bd7213b90d9c001";
const collaboratorId = "66a64ab05bd7213b90d9b001";
const documentTypeId = "66a64ab05bd7213b90d9b010";
const now = new Date("2026-07-30T12:00:00.000Z");
const later = new Date("2026-07-30T13:00:00.000Z");

const document = () =>
  CollaboratorDocument.createPendingCycle(
    {id, collaboratorId, documentTypeId},
    now
  )._unsafeUnwrap();

const persisted = (overrides: Record<string, unknown> = {}) => ({
  _id: {toString: () => id},
  collaboratorId,
  documentTypeId,
  status: "PENDING" as const,
  currentVersion: 0,
  versions: [],
  lastSubmittedAt: null,
  linkedAt: now,
  unlinkedAt: null,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
  ...overrides
});

const expectFailureCode = (result: Result<unknown, {code: string}>, code: string) => {
  expect(result.isErr()).toBe(true);
  if (result.isErr()) expect(result.error.code).toBe(code);
};

describe("CollaboratorDocument Mongo mapper", () => {
  it("serializes a valid aggregate for persistence", () => {
    const result = collaboratorDocumentToMongoDocument(document());

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toMatchObject({
        collaboratorId,
        documentTypeId,
        status: "PENDING",
        currentVersion: 0,
        deletedAt: null
      });
      expect(result.value._id.toString()).toBe(id);
    }
  });

  it("reconstitutes rows from either Mongo _id or the id fallback", () => {
    const fromObjectId = collaboratorDocumentFromMongoDocument(persisted());
    const fromId = collaboratorDocumentFromMongoDocument(persisted({_id: undefined, id}));
    const withDates = collaboratorDocumentFromMongoDocument(
      persisted({
        status: "SUBMITTED",
        currentVersion: 1,
        versions: [{version: 1}],
        lastSubmittedAt: later,
        unlinkedAt: later,
        deletedAt: later
      })
    );

    expect(fromObjectId.isOk()).toBe(true);
    expect(fromId.isOk()).toBe(true);
    expect(withDates.isOk()).toBe(true);
  });

  it("maps malformed persistence data into modeled failures", () => {
    expectFailureCode(
      collaboratorDocumentFromMongoDocument(persisted({createdAt: "not-a-date"})),
      "INTERNAL_SERVER_ERROR"
    );
    expectFailureCode(
      collaboratorDocumentFromMongoDocument(persisted({_id: undefined, id: ""})),
      "INTERNAL_SERVER_ERROR"
    );
    expectFailureCode(
      collaboratorDocumentFromMongoDocument(persisted({status: "NOPE"})),
      "INTERNAL_SERVER_ERROR"
    );
    expectFailureCode(
      collaboratorDocumentOutputFromMongoDocument(persisted({linkedAt: "bad"})),
      "INTERNAL_SERVER_ERROR"
    );
  });

  // BDD gap: persisted lifecycle corruption is not a client validation error.
  it("hides lifecycle-corrupt persistence data behind an internal failure", () => {
    const invalidPending = persisted({
      currentVersion: 1,
      versions: [{version: 1}],
      lastSubmittedAt: later
    });
    const invalidHistory = persisted({
      status: "SUBMITTED",
      currentVersion: 3,
      versions: [{version: 1}, {version: 3}],
      lastSubmittedAt: later
    });

    expectFailureCode(
      collaboratorDocumentFromMongoDocument(invalidPending),
      "INTERNAL_SERVER_ERROR"
    );
    expectFailureCode(
      collaboratorDocumentOutputFromMongoDocument(invalidHistory),
      "INTERNAL_SERVER_ERROR"
    );
  });

  it("projects output ISO timestamps including optional date fields", () => {
    const result = collaboratorDocumentOutputFromMongoDocument(
      persisted({
        status: "SUBMITTED",
        currentVersion: 1,
        versions: [{version: 1}],
        lastSubmittedAt: later,
        unlinkedAt: later,
        deletedAt: later
      })
    );

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toMatchObject({
        status: "SUBMITTED",
        lastSubmittedAt: later.toISOString(),
        unlinkedAt: later.toISOString(),
        deletedAt: later.toISOString(),
        versionCount: 1
      });
    }
  });
});
