import type {Result} from "neverthrow";
import {describe, expect, it} from "vitest";

import {DocumentType} from "../../../src/modules/document-types/domain/entities/document-type.js";
import {
  documentTypeFromMongoDocument,
  documentTypeToMongoDocument,
  normalizeDocumentTypeName
} from "../../../src/modules/document-types/infrastructure/persistence/mongodb/document-type.mongo-mapper.js";

const createdAt = new Date("2026-07-30T12:00:00.000Z");
const updatedAt = new Date("2026-07-30T13:00:00.000Z");
const validId = "66a64ab05bd7213b90d9b010";

const aggregate = (id = validId) =>
  DocumentType.create(
    {id, name: "Atestado Médico", code: "ASO", description: "Exame ocupacional"},
    createdAt
  )._unsafeUnwrap();

const persisted = (overrides: Record<string, unknown> = {}) => ({
  _id: {toString: () => validId},
  name: "Atestado Médico",
  nameNormalized: "atestado medico",
  code: "ASO",
  description: "Exame ocupacional",
  createdAt,
  updatedAt,
  deletedAt: null,
  ...overrides
});

const expectFailureCode = (result: Result<unknown, {code: string}>, code: string) => {
  expect(result.isErr()).toBe(true);
  if (result.isErr()) expect(result.error.code).toBe(code);
};

describe("Document type Mongo mapper", () => {
  it("normalizes names and serializes a valid aggregate", () => {
    expect(normalizeDocumentTypeName("  ÁNA   São  ")).toBe("ana sao");

    const result = documentTypeToMongoDocument(aggregate());

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toMatchObject({
        name: "Atestado Médico",
        nameNormalized: "atestado medico",
        code: "ASO",
        description: "Exame ocupacional",
        createdAt,
        updatedAt: createdAt,
        deletedAt: null
      });
      expect(result.value._id.toString()).toBe(validId);
    }
  });

  it("rejects an aggregate whose identifier cannot be represented by Mongo", () => {
    expectFailureCode(
      documentTypeToMongoDocument(aggregate("not-a-mongo-id")),
      "INTERNAL_SERVER_ERROR"
    );
  });

  it("reconstitutes rows from Mongo ids, fallback ids, and optional values", () => {
    const fromObjectId = documentTypeFromMongoDocument(persisted());
    const fromId = documentTypeFromMongoDocument(persisted({_id: undefined, id: validId}));
    const deleted = documentTypeFromMongoDocument(persisted({deletedAt: updatedAt}));
    const optionalValues = documentTypeFromMongoDocument(
      persisted({description: undefined, deletedAt: undefined})
    );

    for (const result of [fromObjectId, fromId, deleted, optionalValues]) {
      expect(result.isOk()).toBe(true);
    }
    if (deleted.isOk()) expect(deleted.value.deletedAt).toEqual(updatedAt);
    if (optionalValues.isOk()) expect(optionalValues.value.props.description).toBeNull();
  });

  it("rejects each malformed persistence shape", () => {
    const malformed = [
      persisted({_id: undefined, id: ""}),
      persisted({name: 42}),
      persisted({code: 42}),
      persisted({createdAt: "not-a-date"}),
      persisted({updatedAt: "not-a-date"}),
      persisted({deletedAt: "not-a-date"}),
      persisted({description: 42})
    ];

    for (const row of malformed) {
      expectFailureCode(documentTypeFromMongoDocument(row), "INTERNAL_SERVER_ERROR");
    }
  });

  it("maps invalid value objects and reconstitution failures", () => {
    const invalidName = documentTypeFromMongoDocument(persisted({name: ""}));
    const invalidCode = documentTypeFromMongoDocument(persisted({code: "lowercase"}));
    const invalidDescription = documentTypeFromMongoDocument(
      persisted({description: "x".repeat(1001)})
    );

    for (const result of [invalidName, invalidCode, invalidDescription]) {
      expectFailureCode(result, "INTERNAL_SERVER_ERROR");
    }
  });
});
