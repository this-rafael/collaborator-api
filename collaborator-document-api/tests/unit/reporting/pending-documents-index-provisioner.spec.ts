import type {MongooseService} from "@tsed/mongoose";
import type {Result} from "neverthrow";
import {describe, expect, it, vi} from "vitest";

import {
  PendingDocumentsIndexProvisioner,
  pendingDocumentIndexes
} from "../../../src/modules/reporting/infrastructure/persistence/mongodb/pending-documents.indexes.js";

const connectedMongoose = (createIndexes: (indexes: unknown[]) => Promise<readonly string[]>) =>
  ({
    get: () => ({
      db: {
        collection: () => ({createIndexes})
      }
    })
  }) as unknown as MongooseService;

const expectFailureCode = (result: Result<unknown, {code: string}>, code: string) => {
  expect(result.isErr()).toBe(true);
  if (result.isErr()) expect(result.error.code).toBe(code);
};

describe("PendingDocumentsIndexProvisioner", () => {
  it("creates exactly the declared reporting indexes", async () => {
    const createIndexes = vi
      .fn<(indexes: unknown[]) => Promise<readonly string[]>>()
      .mockResolvedValue([
        "collaborator_documents_pending_reporting_keyset",
        "collaborator_documents_latest_submissions_keyset"
      ]);

    const result = await new PendingDocumentsIndexProvisioner(
      connectedMongoose(createIndexes)
    ).ensure();

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toEqual([
        "collaborator_documents_pending_reporting_keyset",
        "collaborator_documents_latest_submissions_keyset"
      ]);
    }
    expect(createIndexes).toHaveBeenCalledWith([...pendingDocumentIndexes]);
  });

  it("returns service unavailable when the database handle is missing", async () => {
    const result = await new PendingDocumentsIndexProvisioner({
      get: () => undefined
    } as MongooseService).ensure();

    expectFailureCode(result, "SERVICE_UNAVAILABLE");
  });

  it("maps technical provisioning failures without throwing", async () => {
    const unavailable = await new PendingDocumentsIndexProvisioner({
      get: () => {
        throw new Error("connection failed");
      }
    } as unknown as MongooseService).ensure();
    const rejected = await new PendingDocumentsIndexProvisioner(
      connectedMongoose(async () => {
        throw new Error("create indexes failed");
      })
    ).ensure();

    for (const result of [unavailable, rejected]) {
      expectFailureCode(result, "INTERNAL_SERVER_ERROR");
    }
  });
});
