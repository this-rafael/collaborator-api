import {describe, expect, it} from "vitest";
import type {Result} from "neverthrow";

import {Collaborator} from "../../src/modules/collaborators/domain/entities/collaborator.js";
import {
  collaboratorFromMongoDocument,
  collaboratorToMongoDocument,
  normalizeCollaboratorName
} from "../../src/modules/collaborators/infrastructure/persistence/mongodb/collaborator.mongo-mapper.js";

const createdAt = new Date("2026-07-29T12:00:00.000Z");
const updatedAt = new Date("2026-07-29T13:00:00.000Z");
const validId = "66a64ab05bd7213b90d9b001";

const collaborator = (id = validId) =>
  Collaborator.create(
    {id, name: "Ána  Silva", cpf: "12345678909", email: "ANA@example.com"},
    createdAt
  )._unsafeUnwrap();

const persisted = (overrides: Record<string, unknown> = {}) => ({
  _id: {toString: () => validId},
  name: "Ána Silva",
  cpf: "12345678909",
  email: "ana@example.com",
  createdAt,
  updatedAt,
  deletedAt: null,
  ...overrides
});

const expectFailureCode = (result: Result<unknown, {code: string}>, code: string) => {
  expect(result.isErr()).toBe(true);
  if (result.isErr()) expect(result.error.code).toBe(code);
};

describe("Collaborator Mongo mapper", () => {
  it("normalizes names and serializes a valid aggregate", () => {
    expect(normalizeCollaboratorName("  ÁNA São  ")).toBe("  ana sao  ");

    const result = collaboratorToMongoDocument(collaborator());

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toMatchObject({
        name: "Ána Silva",
        nameNormalized: "ana silva",
        cpf: "12345678909",
        email: "ana@example.com",
        createdAt,
        updatedAt: createdAt,
        deletedAt: null
      });
      expect(result.value._id.toString()).toBe(validId);
    }
  });

  it("rejects an aggregate whose identifier cannot be represented by Mongo", () => {
    const result = collaboratorToMongoDocument(collaborator("not-a-mongo-id"));

    expectFailureCode(result, "INTERNAL_SERVER_ERROR");
  });

  it("reconstitutes rows from either Mongo _id or the id fallback", () => {
    const fromObjectId = collaboratorFromMongoDocument(persisted());
    const fromId = collaboratorFromMongoDocument(persisted({_id: undefined, id: validId}));
    const deleted = collaboratorFromMongoDocument(persisted({deletedAt: updatedAt}));

    expect(fromObjectId.isOk()).toBe(true);
    expect(fromId.isOk()).toBe(true);
    expect(deleted.isOk()).toBe(true);
    if (deleted.isOk()) expect(deleted.value.deletedAt).toEqual(updatedAt);
  });

  it("turns malformed persistence data and invalid persisted values into modeled failures", () => {
    const malformed = collaboratorFromMongoDocument(persisted({createdAt: "not-a-date"}));
    const invalidValue = collaboratorFromMongoDocument(persisted({name: ""}));
    const invalidId = collaboratorFromMongoDocument(persisted({_id: undefined, id: ""}));
    const invalidDeletionDate = collaboratorFromMongoDocument(persisted({deletedAt: "invalid"}));

    for (const result of [malformed, invalidValue, invalidId, invalidDeletionDate]) {
      expectFailureCode(result, "INTERNAL_SERVER_ERROR");
    }
  });
});
