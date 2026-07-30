import type {MongooseService} from "@tsed/mongoose";
import type {ClientSession} from "mongoose";
import type {Result} from "neverthrow";
import {describe, expect, it} from "vitest";

import {Collaborator} from "../../src/modules/collaborators/domain/entities/collaborator.js";
import {MongoCollaboratorRepository} from "../../src/modules/collaborators/infrastructure/persistence/mongodb/collaborator.mongo-repository.js";
import {createMongoTransactionContext} from "../../src/shared/infrastructure/persistence/mongodb/mongo-transaction-context.js";

const now = new Date("2026-07-29T12:00:00.000Z");
const validId = "66a64ab05bd7213b90d9b001";

const collaborator = (id = validId) =>
  Collaborator.create(
    {
      id,
      name: "Ana Silva",
      cpf: "12345678909",
      email: "ana@example.com"
    },
    now
  )._unsafeUnwrap();

const row = (overrides: Record<string, unknown> = {}) => ({
  _id: {toString: () => validId},
  name: "Ana Silva",
  nameNormalized: "ana silva",
  cpf: "12345678909",
  email: "ana@example.com",
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
  ...overrides
});

const mongooseWithModel = (model: object): MongooseService =>
  ({
    get: () => ({readyState: 1, models: {Collaborator: model}})
  }) as unknown as MongooseService;

const expectFailureCode = (result: Result<unknown, {code: string}>, code: string) => {
  expect(result.isErr()).toBe(true);
  if (result.isErr()) expect(result.error.code).toBe(code);
};

describe("MongoCollaboratorRepository", () => {
  it("returns a modeled unavailability failure without an active connection", async () => {
    const repository = new MongoCollaboratorRepository({get: () => undefined} as MongooseService);

    const result = await repository.create(collaborator());

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe("SERVICE_UNAVAILABLE");
  });

  it("maps duplicate-key errors to the CPF conflict", async () => {
    const mongoose = {
      get: () => ({
        readyState: 1,
        models: {},
        model: () => ({
          create: async () => {
            throw {keyPattern: {cpf: 1}};
          }
        })
      })
    } as unknown as MongooseService;
    const repository = new MongoCollaboratorRepository(mongoose);

    const result = await repository.create(collaborator());

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe("DUPLICATE_ACTIVE_CPF");
  });

  it("guards invalid ids and maps missing and unavailable reads", async () => {
    const invalidId = await new MongoCollaboratorRepository(mongooseWithModel({})).findById(
      "invalid"
    );
    const missing = await new MongoCollaboratorRepository(
      mongooseWithModel({findById: () => ({lean: async () => null})})
    ).findById(validId);
    const unavailable = await new MongoCollaboratorRepository(
      mongooseWithModel({
        findById: () => ({
          lean: async () => {
            throw {name: "MongoServerSelectionError"};
          }
        })
      })
    ).findById(validId);

    expectFailureCode(invalidId, "VALIDATION_ERROR");
    expectFailureCode(missing, "COLLABORATOR_NOT_FOUND");
    expectFailureCode(unavailable, "SERVICE_UNAVAILABLE");
  });

  it("does not rely on a working Mongoose getter or model factory", async () => {
    const getterFailure = await new MongoCollaboratorRepository({
      get: () => {
        throw new Error("Mongoose unavailable");
      }
    } as unknown as MongooseService).findById(validId);
    const modelFailure = await new MongoCollaboratorRepository({
      get: () => ({readyState: 1, models: {}, model: () => undefined})
    } as unknown as MongooseService).findById(validId);

    for (const result of [getterFailure, modelFailure]) {
      expectFailureCode(result, "SERVICE_UNAVAILABLE");
    }
  });

  it("maps email conflicts and unexpected persistence failures", async () => {
    const duplicateEmail = await new MongoCollaboratorRepository(
      mongooseWithModel({
        create: async () => {
          throw {keyPattern: {email: 1}};
        }
      })
    ).create(collaborator());
    const unexpected = await new MongoCollaboratorRepository(
      mongooseWithModel({
        create: async () => {
          throw new Error("validation error");
        }
      })
    ).create(collaborator());
    const invalidAggregateId = await new MongoCollaboratorRepository(mongooseWithModel({})).create(
      collaborator("not-a-mongo-id")
    );

    expectFailureCode(duplicateEmail, "DUPLICATE_ACTIVE_EMAIL");
    expectFailureCode(unexpected, "INTERNAL_SERVER_ERROR");
    expectFailureCode(invalidAggregateId, "INTERNAL_SERVER_ERROR");
  });

  it("maps invalid list cursors, malformed rows, and technical list failures", async () => {
    const invalidCursor = await new MongoCollaboratorRepository(mongooseWithModel({})).listActive({
      filters: {},
      afterId: "invalid",
      limit: 1
    });
    const malformed = await new MongoCollaboratorRepository(
      mongooseWithModel({
        find: () => ({sort: () => ({limit: () => ({lean: async () => [{}]})})})
      })
    ).listActive({filters: {}, limit: 1});
    const technicalFailure = await new MongoCollaboratorRepository(
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

    expectFailureCode(invalidCursor, "INVALID_QUERY_PARAMETER");
    expectFailureCode(malformed, "INTERNAL_SERVER_ERROR");
    expectFailureCode(technicalFailure, "INTERNAL_SERVER_ERROR");
  });

  it("distinguishes active updates from deleted and missing collaborators", async () => {
    const updated = await new MongoCollaboratorRepository(
      mongooseWithModel({findOneAndUpdate: () => ({lean: async () => row()})})
    ).updateActive(collaborator());
    const deleted = await new MongoCollaboratorRepository(
      mongooseWithModel({
        findOneAndUpdate: () => ({lean: async () => null}),
        findById: () => ({select: () => ({lean: async () => ({deletedAt: now})})})
      })
    ).updateActive(collaborator());
    const missing = await new MongoCollaboratorRepository(
      mongooseWithModel({
        findOneAndUpdate: () => ({lean: async () => null}),
        findById: () => ({select: () => ({lean: async () => ({deletedAt: null})})})
      })
    ).updateActive(collaborator());

    expect(updated.isOk()).toBe(true);
    expectFailureCode(deleted, "COLLABORATOR_DELETED");
    expectFailureCode(missing, "COLLABORATOR_NOT_FOUND");
  });

  it("uses the opaque transaction context and preserves soft-delete outcomes", async () => {
    const context = createMongoTransactionContext({} as ClientSession);
    const updated = await new MongoCollaboratorRepository(
      mongooseWithModel({updateOne: async () => ({modifiedCount: 1})})
    ).softDeleteActive(collaborator(), context);
    const unchanged = await new MongoCollaboratorRepository(
      mongooseWithModel({updateOne: async () => ({modifiedCount: 0})})
    ).softDeleteActive(collaborator(), context);
    const noSession = await new MongoCollaboratorRepository(
      mongooseWithModel({updateOne: async () => ({modifiedCount: 1})})
    ).softDeleteActive(collaborator(), {} as never);
    const technicalFailure = await new MongoCollaboratorRepository(
      mongooseWithModel({
        updateOne: async () => {
          throw new Error("write failed");
        }
      })
    ).softDeleteActive(collaborator(), context);

    expect(updated.isOk()).toBe(true);
    expect(unchanged.isOk()).toBe(true);
    if (updated.isOk()) expect(updated.value).toBe(true);
    if (unchanged.isOk()) expect(unchanged.value).toBe(false);
    expectFailureCode(noSession, "SERVICE_UNAVAILABLE");
    expectFailureCode(technicalFailure, "INTERNAL_SERVER_ERROR");
  });
});
