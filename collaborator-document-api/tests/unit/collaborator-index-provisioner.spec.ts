import type {MongooseService} from "@tsed/mongoose";
import type {Result} from "neverthrow";
import {describe, expect, it, vi} from "vitest";

import {
  collaboratorIndexes,
  CollaboratorIndexProvisioner,
  ensureCollaboratorIndexes
} from "../../src/modules/collaborators/infrastructure/persistence/mongodb/collaborator.indexes.js";

const connectedMongoose = (createIndexes: (indexes: unknown[]) => Promise<readonly string[]>) =>
  ({
    get: () => ({
      readyState: 1,
      models: {Collaborator: {collection: {createIndexes}}}
    })
  }) as unknown as MongooseService;

const expectFailureCode = (result: Result<unknown, {code: string}>, code: string) => {
  expect(result.isErr()).toBe(true);
  if (result.isErr()) expect(result.error.code).toBe(code);
};

describe("CollaboratorIndexProvisioner", () => {
  it("creates exactly the declared indexes through the injected connection", async () => {
    const createIndexes = vi
      .fn<(indexes: unknown[]) => Promise<readonly string[]>>()
      .mockResolvedValue(["collaborators_active_cpf_unique"]);

    const result = await ensureCollaboratorIndexes(connectedMongoose(createIndexes));

    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value).toEqual(["collaborators_active_cpf_unique"]);
    expect(createIndexes).toHaveBeenCalledWith([...collaboratorIndexes]);
  });

  it("returns service unavailable for missing or inactive connections", async () => {
    const missing = await new CollaboratorIndexProvisioner({
      get: () => undefined
    } as MongooseService).ensure();
    const inactive = await new CollaboratorIndexProvisioner({
      get: () => ({readyState: 0})
    } as MongooseService).ensure();

    for (const result of [missing, inactive]) {
      expectFailureCode(result, "SERVICE_UNAVAILABLE");
    }
  });

  it("maps technical provisioning failures without throwing", async () => {
    const unavailable = await new CollaboratorIndexProvisioner({
      get: () => {
        throw new Error("connection failed");
      }
    } as unknown as MongooseService).ensure();
    const rejected = await new CollaboratorIndexProvisioner(
      connectedMongoose(async () => {
        throw new Error("create indexes failed");
      })
    ).ensure();

    for (const result of [unavailable, rejected]) {
      expectFailureCode(result, "INTERNAL_SERVER_ERROR");
    }
  });
});
