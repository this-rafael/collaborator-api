import type {MongooseService} from "@tsed/mongoose";
import type {Result} from "neverthrow";
import {describe, expect, it, vi} from "vitest";

import {
  collaboratorDocumentIndexes,
  CollaboratorDocumentIndexProvisioner,
  ensureCollaboratorDocumentIndexes
} from "../../../src/modules/collaborator-documents/infrastructure/persistence/mongodb/collaborator-document.indexes.js";

const connectedMongoose = (createIndexes: (indexes: unknown[]) => Promise<readonly string[]>) =>
  ({
    get: () => ({
      readyState: 1,
      models: {CollaboratorDocument: {collection: {createIndexes}}}
    })
  }) as unknown as MongooseService;

const expectFailureCode = (result: Result<unknown, {code: string}>, code: string) => {
  expect(result.isErr()).toBe(true);
  if (result.isErr()) expect(result.error.code).toBe(code);
};

describe("CollaboratorDocumentIndexProvisioner", () => {
  it("creates exactly the declared indexes through the helper", async () => {
    const createIndexes = vi
      .fn<(indexes: unknown[]) => Promise<readonly string[]>>()
      .mockResolvedValue(["collaborator_documents_active_pair_unique"]);

    const result = await ensureCollaboratorDocumentIndexes(connectedMongoose(createIndexes));

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toEqual(["collaborator_documents_active_pair_unique"]);
    }
    expect(createIndexes).toHaveBeenCalledWith([...collaboratorDocumentIndexes]);
  });

  it("returns service unavailable for missing or inactive connections", async () => {
    const missing = await new CollaboratorDocumentIndexProvisioner({
      get: () => undefined
    } as MongooseService).ensure();
    const inactive = await new CollaboratorDocumentIndexProvisioner({
      get: () => ({readyState: 0})
    } as MongooseService).ensure();

    for (const result of [missing, inactive]) {
      expectFailureCode(result, "SERVICE_UNAVAILABLE");
    }
  });

  it("maps connection and index creation failures", async () => {
    const getterFailure = await new CollaboratorDocumentIndexProvisioner({
      get: () => {
        throw new Error("connection failed");
      }
    } as unknown as MongooseService).ensure();
    const indexFailure = await new CollaboratorDocumentIndexProvisioner(
      connectedMongoose(async () => {
        throw new Error("create indexes failed");
      })
    ).ensure();

    for (const result of [getterFailure, indexFailure]) {
      expectFailureCode(result, "INTERNAL_SERVER_ERROR");
    }
  });
});
