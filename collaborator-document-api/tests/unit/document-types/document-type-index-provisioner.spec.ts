import type {MongooseService} from "@tsed/mongoose";
import type {Result} from "neverthrow";
import {describe, expect, it, vi} from "vitest";

import {
  documentTypeIndexes,
  DocumentTypeIndexProvisioner,
  ensureDocumentTypeIndexes
} from "../../../src/modules/document-types/infrastructure/persistence/mongodb/document-type.indexes.js";

const connectedMongoose = (createIndexes: (indexes: unknown[]) => Promise<readonly string[]>) =>
  ({
    get: () => ({
      readyState: 1,
      models: {DocumentType: {collection: {createIndexes}}}
    })
  }) as unknown as MongooseService;

const expectFailureCode = (result: Result<unknown, {code: string}>, code: string) => {
  expect(result.isErr()).toBe(true);
  if (result.isErr()) expect(result.error.code).toBe(code);
};

describe("DocumentTypeIndexProvisioner", () => {
  it("creates exactly the declared indexes through the helper", async () => {
    const createIndexes = vi
      .fn<(indexes: unknown[]) => Promise<readonly string[]>>()
      .mockResolvedValue(["document_types_active_code_unique"]);

    const result = await ensureDocumentTypeIndexes(connectedMongoose(createIndexes));

    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value).toEqual(["document_types_active_code_unique"]);
    expect(createIndexes).toHaveBeenCalledWith([...documentTypeIndexes]);
  });

  it("returns service unavailable for missing or inactive connections", async () => {
    const missing = await new DocumentTypeIndexProvisioner({
      get: () => undefined
    } as MongooseService).ensure();
    const inactive = await new DocumentTypeIndexProvisioner({
      get: () => ({readyState: 0})
    } as MongooseService).ensure();

    for (const result of [missing, inactive]) {
      expectFailureCode(result, "SERVICE_UNAVAILABLE");
    }
  });

  it("maps connection and index creation failures", async () => {
    const getterFailure = await new DocumentTypeIndexProvisioner({
      get: () => {
        throw new Error("connection failed");
      }
    } as unknown as MongooseService).ensure();
    const indexFailure = await new DocumentTypeIndexProvisioner(
      connectedMongoose(async () => {
        throw new Error("create indexes failed");
      })
    ).ensure();

    for (const result of [getterFailure, indexFailure]) {
      expectFailureCode(result, "INTERNAL_SERVER_ERROR");
    }
  });
});
