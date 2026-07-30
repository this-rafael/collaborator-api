import type {MongooseService} from "@tsed/mongoose";
import type {ClientSession} from "mongoose";
import type {Result} from "neverthrow";
import {describe, expect, it} from "vitest";

import {DocumentType} from "../../../src/modules/document-types/domain/entities/document-type.js";
import {MongoDocumentTypeRepository} from "../../../src/modules/document-types/infrastructure/persistence/mongodb/document-type.mongo-repository.js";
import {createMongoTransactionContext} from "../../../src/shared/infrastructure/persistence/mongodb/mongo-transaction-context.js";

const now = new Date("2026-07-30T12:00:00.000Z");
const validId = "66a64ab05bd7213b90d9b010";
const nextId = "66a64ab05bd7213b90d9b011";

const documentType = (id = validId) =>
  DocumentType.create(
    {id, name: "Atestado", code: "ASO", description: "Exame ocupacional"},
    now
  )._unsafeUnwrap();

const row = (overrides: Record<string, unknown> = {}) => ({
  _id: {toString: () => validId},
  name: "Atestado",
  nameNormalized: "atestado",
  code: "ASO",
  description: "Exame ocupacional",
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
  ...overrides
});

const mongooseWithModel = (model: object): MongooseService =>
  ({
    get: () => ({readyState: 1, models: {DocumentType: model}})
  }) as unknown as MongooseService;

const expectFailureCode = (result: Result<unknown, {code: string}>, code: string) => {
  expect(result.isErr()).toBe(true);
  if (result.isErr()) expect(result.error.code).toBe(code);
};

describe("MongoDocumentTypeRepository", () => {
  it("returns modeled unavailability for missing, inactive, and failing connections", async () => {
    const missing = await new MongoDocumentTypeRepository({
      get: () => undefined
    } as MongooseService).create(documentType());
    const inactive = await new MongoDocumentTypeRepository({
      get: () => ({readyState: 0})
    } as MongooseService).findById(validId);
    const getterFailure = await new MongoDocumentTypeRepository({
      get: () => {
        throw new Error("Mongoose unavailable");
      }
    } as unknown as MongooseService).findById(validId);
    const modelFailure = await new MongoDocumentTypeRepository({
      get: () => ({
        readyState: 1,
        models: {},
        model: () => {
          throw new Error("model unavailable");
        }
      })
    } as unknown as MongooseService).findById(validId);

    for (const result of [missing, inactive, getterFailure, modelFailure]) {
      expectFailureCode(result, "SERVICE_UNAVAILABLE");
    }
  });

  it("creates and reconstitutes a persisted document type", async () => {
    const result = await new MongoDocumentTypeRepository(
      mongooseWithModel({
        create: async () => ({toObject: () => row()})
      })
    ).create(documentType());

    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value.props.code.value).toBe("ASO");
  });

  it("maps duplicate codes, network failures, invalid ids, and unexpected create failures", async () => {
    const duplicate = await new MongoDocumentTypeRepository(
      mongooseWithModel({
        create: async () => {
          throw {keyPattern: {code: 1}};
        }
      })
    ).create(documentType());
    const network = await new MongoDocumentTypeRepository(
      mongooseWithModel({
        create: async () => {
          throw {name: "MongoNetworkError"};
        }
      })
    ).create(documentType());
    const unexpected = await new MongoDocumentTypeRepository(
      mongooseWithModel({
        create: async () => {
          throw new Error("write failed");
        }
      })
    ).create(documentType());
    const unnamedFailure = await new MongoDocumentTypeRepository(
      mongooseWithModel({
        create: async () => {
          throw {};
        }
      })
    ).create(documentType());
    const invalidAggregateId = await new MongoDocumentTypeRepository(mongooseWithModel({})).create(
      documentType("invalid")
    );

    expectFailureCode(duplicate, "DUPLICATE_ACTIVE_DOCUMENT_TYPE_CODE");
    expectFailureCode(network, "SERVICE_UNAVAILABLE");
    expectFailureCode(unexpected, "INTERNAL_SERVER_ERROR");
    expectFailureCode(unnamedFailure, "INTERNAL_SERVER_ERROR");
    expectFailureCode(invalidAggregateId, "INTERNAL_SERVER_ERROR");
  });

  it("guards invalid ids and maps found, missing, malformed, and failed reads", async () => {
    const invalidId = await new MongoDocumentTypeRepository(mongooseWithModel({})).findById(
      "invalid"
    );
    const found = await new MongoDocumentTypeRepository(
      mongooseWithModel({findById: () => ({lean: async () => row()})})
    ).findById(validId);
    const missing = await new MongoDocumentTypeRepository(
      mongooseWithModel({findById: () => ({lean: async () => null})})
    ).findById(validId);
    const malformed = await new MongoDocumentTypeRepository(
      mongooseWithModel({findById: () => ({lean: async () => ({})})})
    ).findById(validId);
    const unavailable = await new MongoDocumentTypeRepository(
      mongooseWithModel({
        findById: () => ({
          lean: async () => {
            throw {name: "MongoServerSelectionError"};
          }
        })
      })
    ).findById(validId);

    expectFailureCode(invalidId, "VALIDATION_ERROR");
    expect(found.isOk()).toBe(true);
    expectFailureCode(missing, "DOCUMENT_TYPE_NOT_FOUND");
    expectFailureCode(malformed, "INTERNAL_SERVER_ERROR");
    expectFailureCode(unavailable, "SERVICE_UNAVAILABLE");
  });

  it("builds filtered pagination queries and reports both page outcomes", async () => {
    let capturedFilter: Record<string, unknown> | undefined;
    const filtered = await new MongoDocumentTypeRepository(
      mongooseWithModel({
        find: (filter: Record<string, unknown>) => {
          capturedFilter = filter;
          return {
            sort: () => ({
              limit: () => ({
                lean: async () => [row(), row({_id: {toString: () => nextId}, code: "LDO"})]
              })
            })
          };
        }
      })
    ).listActive({
      filters: {name: "Atestado (Médico).", code: "ASO"},
      afterId: validId,
      limit: 1
    });
    const empty = await new MongoDocumentTypeRepository(
      mongooseWithModel({
        find: () => ({sort: () => ({limit: () => ({lean: async () => []})})})
      })
    ).listActive({filters: {}, limit: 1});

    expect(filtered.isOk()).toBe(true);
    if (filtered.isOk()) {
      expect(filtered.value.items).toHaveLength(1);
      expect(filtered.value.hasNext).toBe(true);
    }
    expect(capturedFilter).toMatchObject({
      deletedAt: null,
      nameNormalized: {$regex: "atestado \\(medico\\)\\."},
      code: "ASO"
    });
    expect(capturedFilter?._id).toBeDefined();
    expect(empty.isOk()).toBe(true);
    if (empty.isOk()) expect(empty.value.hasNext).toBe(false);
  });

  it("maps invalid cursors, malformed list rows, and technical list failures", async () => {
    const unavailable = await new MongoDocumentTypeRepository({
      get: () => undefined
    } as MongooseService).listActive({filters: {}, limit: 1});
    const invalidCursor = await new MongoDocumentTypeRepository(mongooseWithModel({})).listActive({
      filters: {},
      afterId: "invalid",
      limit: 1
    });
    const malformed = await new MongoDocumentTypeRepository(
      mongooseWithModel({
        find: () => ({sort: () => ({limit: () => ({lean: async () => [{}]})})})
      })
    ).listActive({filters: {}, limit: 1});
    const technicalFailure = await new MongoDocumentTypeRepository(
      mongooseWithModel({
        find: () => ({
          sort: () => ({
            limit: () => ({
              lean: async () => {
                throw new Error("query failed");
              }
            })
          })
        })
      })
    ).listActive({filters: {}, limit: 1});

    expectFailureCode(unavailable, "SERVICE_UNAVAILABLE");
    expectFailureCode(invalidCursor, "INVALID_QUERY_PARAMETER");
    expectFailureCode(malformed, "INTERNAL_SERVER_ERROR");
    expectFailureCode(technicalFailure, "INTERNAL_SERVER_ERROR");
  });

  it("distinguishes updated, deleted, and missing document types", async () => {
    const updated = await new MongoDocumentTypeRepository(
      mongooseWithModel({findOneAndUpdate: () => ({lean: async () => row()})})
    ).updateActive(documentType());
    const deleted = await new MongoDocumentTypeRepository(
      mongooseWithModel({
        findOneAndUpdate: () => ({lean: async () => null}),
        findById: () => ({select: () => ({lean: async () => ({deletedAt: now})})})
      })
    ).updateActive(documentType());
    const activeButNotUpdated = await new MongoDocumentTypeRepository(
      mongooseWithModel({
        findOneAndUpdate: () => ({lean: async () => null}),
        findById: () => ({select: () => ({lean: async () => ({deletedAt: null})})})
      })
    ).updateActive(documentType());
    const missing = await new MongoDocumentTypeRepository(
      mongooseWithModel({
        findOneAndUpdate: () => ({lean: async () => null}),
        findById: () => ({select: () => ({lean: async () => null})})
      })
    ).updateActive(documentType());

    expect(updated.isOk()).toBe(true);
    expectFailureCode(deleted, "DOCUMENT_TYPE_DELETED");
    expectFailureCode(activeButNotUpdated, "DOCUMENT_TYPE_NOT_FOUND");
    expectFailureCode(missing, "DOCUMENT_TYPE_NOT_FOUND");
  });

  it("maps invalid aggregate ids and persistence failures during updates", async () => {
    const unavailable = await new MongoDocumentTypeRepository({
      get: () => undefined
    } as MongooseService).updateActive(documentType());
    const invalidAggregateId = await new MongoDocumentTypeRepository(
      mongooseWithModel({})
    ).updateActive(documentType("invalid"));
    const duplicate = await new MongoDocumentTypeRepository(
      mongooseWithModel({
        findOneAndUpdate: () => ({
          lean: async () => {
            throw {keyPattern: {code: 1}};
          }
        })
      })
    ).updateActive(documentType());
    const technicalFailure = await new MongoDocumentTypeRepository(
      mongooseWithModel({
        findOneAndUpdate: () => ({
          lean: async () => {
            throw new Error("update failed");
          }
        })
      })
    ).updateActive(documentType());

    expectFailureCode(unavailable, "SERVICE_UNAVAILABLE");
    expectFailureCode(invalidAggregateId, "INTERNAL_SERVER_ERROR");
    expectFailureCode(duplicate, "DUPLICATE_ACTIVE_DOCUMENT_TYPE_CODE");
    expectFailureCode(technicalFailure, "INTERNAL_SERVER_ERROR");
  });

  it("uses the transaction session and preserves soft-delete outcomes", async () => {
    const context = createMongoTransactionContext({} as ClientSession);
    const updated = await new MongoDocumentTypeRepository(
      mongooseWithModel({updateOne: async () => ({modifiedCount: 1})})
    ).softDeleteActive(documentType(), context);
    const unchanged = await new MongoDocumentTypeRepository(
      mongooseWithModel({updateOne: async () => ({modifiedCount: 0})})
    ).softDeleteActive(documentType(), context);
    const noSession = await new MongoDocumentTypeRepository(
      mongooseWithModel({updateOne: async () => ({modifiedCount: 1})})
    ).softDeleteActive(documentType(), {} as never);
    const noModel = await new MongoDocumentTypeRepository({
      get: () => undefined
    } as MongooseService).softDeleteActive(documentType(), context);
    const invalidAggregateId = await new MongoDocumentTypeRepository(
      mongooseWithModel({})
    ).softDeleteActive(documentType("invalid"), context);
    const technicalFailure = await new MongoDocumentTypeRepository(
      mongooseWithModel({
        updateOne: async () => {
          throw new Error("delete failed");
        }
      })
    ).softDeleteActive(documentType(), context);

    expect(updated.isOk()).toBe(true);
    expect(unchanged.isOk()).toBe(true);
    if (updated.isOk()) expect(updated.value).toBe(true);
    if (unchanged.isOk()) expect(unchanged.value).toBe(false);
    expectFailureCode(noSession, "SERVICE_UNAVAILABLE");
    expectFailureCode(noModel, "SERVICE_UNAVAILABLE");
    expectFailureCode(invalidAggregateId, "INTERNAL_SERVER_ERROR");
    expectFailureCode(technicalFailure, "INTERNAL_SERVER_ERROR");
  });
});
