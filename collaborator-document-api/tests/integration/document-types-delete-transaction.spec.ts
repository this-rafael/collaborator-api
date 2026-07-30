import type {ClientSession, Connection} from "mongoose";
import {beforeEach, describe, expect, it} from "vitest";
import {ObjectId} from "mongodb";
import {ok} from "neverthrow";
import {PlatformTest} from "@tsed/platform-http/testing";

import {MongoTransactionManager} from "../../src/shared/infrastructure/persistence/mongodb/mongo-transaction-manager.js";
import {resetDatabase} from "../helpers/database.js";
import {bootstrapHttpMongo, httpDatabase} from "../helpers/http-mongo.js";
import {MongoTransactionTestHarness} from "../helpers/mongo-transaction-test-harness.js";

const documentTypeId = "66a64ab05bd7213b90d9b010";

describe("Deleting document types transactionally", () => {
  bootstrapHttpMongo();
  beforeEach(async () => resetDatabase(httpDatabase()));

  it("commits the type and both active document states in the same transaction", async () => {
    await seedDocumentTypeAndLinks();
    const result = await deleteApplication().then((application) =>
      application.execute({id: documentTypeId})
    );

    expect(result.isOk()).toBe(true);
    const type = await httpDatabase()
      .collection("document_types")
      .findOne({_id: new ObjectId(documentTypeId)});
    const links = await httpDatabase()
      .collection("collaborator_documents")
      .find({documentTypeId})
      .toArray();
    expect(type?.deletedAt).toBeInstanceOf(Date);
    expect(links.map(({status}) => status).sort()).toEqual(["PENDING", "SUBMITTED"]);
    expect(links.every(({deletedAt}) => deletedAt?.getTime() === type?.deletedAt?.getTime())).toBe(
      true
    );
    expect(links.every(({versions}) => versions[0].payload === "preserved")).toBe(true);
  });

  it("does not write the cascade again after an idempotent delete", async () => {
    await seedDocumentTypeAndLinks();
    const application = await deleteApplication();
    expect((await application.execute({id: documentTypeId})).isOk()).toBe(true);
    const first = await httpDatabase()
      .collection("collaborator_documents")
      .find({documentTypeId})
      .toArray();
    expect((await application.execute({id: documentTypeId})).isOk()).toBe(true);
    const repeated = await httpDatabase()
      .collection("collaborator_documents")
      .find({documentTypeId})
      .toArray();
    expect(repeated.map(({deletedAt}) => deletedAt)).toEqual(first.map(({deletedAt}) => deletedAt));
  });

  it("rolls back the type update when the document cascade fails", async () => {
    const db = httpDatabase();
    await db
      .collection("collaborator_documents")
      .drop()
      .catch(() => undefined);
    await db.createCollection("collaborator_documents", {
      validator: {$jsonSchema: {bsonType: "object", properties: {deletedAt: {bsonType: "null"}}}}
    });
    await seedDocumentTypeAndLinks();

    const result = await deleteApplication().then((application) =>
      application.execute({id: documentTypeId})
    );
    expect(result.isErr()).toBe(true);
    const type = await db.collection("document_types").findOne({_id: new ObjectId(documentTypeId)});
    const links = await db.collection("collaborator_documents").find({documentTypeId}).toArray();
    expect(type?.deletedAt).toBeNull();
    expect(links.every(({deletedAt}) => deletedAt === null)).toBe(true);

    await db
      .collection("collaborator_documents")
      .drop()
      .catch(() => undefined);
    await db.createCollection("collaborator_documents");
  });
});

describe("Retrying document type delete transactions", () => {
  it("retries all work after a transient transaction failure", async () => {
    const injected = new MongoTransactionTestHarness();
    injected.failNext("TransientTransactionError");
    const session = sessionHarness(injected);
    const manager = transactionManager(session.session);
    let writes = 0;

    const result = await manager.execute(() => {
      writes += 1;
      const failure = injected.nextFailure();
      if (failure) throw labeledError(failure);
      return Promise.resolve(ok("deleted"));
    });
    expect(result.isOk()).toBe(true);
    expect(writes).toBe(2);
    expect(manager.mongoTransactionRetriesTotal).toBe(1);
  });

  it("retries an unknown commit without reexecuting cascade writes", async () => {
    const injected = new MongoTransactionTestHarness();
    injected.failNext("UnknownTransactionCommitResult");
    const session = sessionHarness(injected, true);
    const manager = transactionManager(session.session);
    let writes = 0;

    const result = await manager.execute(() => {
      writes += 1;
      return Promise.resolve(ok("deleted"));
    });
    expect(result.isOk()).toBe(true);
    expect(writes).toBe(1);
    expect(session.commitCalls.count).toBe(2);
    expect(manager.mongoTransactionRetriesTotal).toBe(1);
  });

  it("returns service unavailable after three transient attempts", async () => {
    const injected = new MongoTransactionTestHarness();
    injected.failNext("TransientTransactionError");
    injected.failNext("TransientTransactionError");
    injected.failNext("TransientTransactionError");
    const session = sessionHarness(injected);
    const manager = transactionManager(session.session);
    let writes = 0;

    const result = await manager.execute<never, never>(() => {
      writes += 1;
      throw labeledError(injected.nextFailure() ?? "TransientTransactionError");
    });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe("SERVICE_UNAVAILABLE");
    expect(writes).toBe(3);
    expect(manager.mongoTransactionRetriesTotal).toBe(2);
  });
});

async function deleteApplication(): Promise<{
  execute(input: {id: string}): Promise<{
    isOk(): boolean;
    isErr(): boolean;
  }>;
}> {
  const {DocumentTypesRuntime} =
    await import("../../src/modules/document-types/document-types.runtime.js");
  return PlatformTest.get<{
    application: {
      delete: {
        execute(input: {id: string}): Promise<{isOk(): boolean; isErr(): boolean}>;
      };
    };
  }>(DocumentTypesRuntime).application.delete;
}

async function seedDocumentTypeAndLinks(): Promise<void> {
  const db = httpDatabase();
  const now = new Date("2026-07-30T12:00:00.000Z");
  await db.collection("document_types").insertOne({
    _id: new ObjectId(documentTypeId),
    name: "Atestado",
    nameNormalized: "atestado",
    code: "ASO",
    description: null,
    deletedAt: null,
    createdAt: now,
    updatedAt: now
  });
  await db
    .collection("collaborator_documents")
    .insertMany([
      link("66a64ab05bd7213b90d9c001", "PENDING", "66a64ab05bd7213b90d9b001"),
      link("66a64ab05bd7213b90d9c002", "SUBMITTED", "66a64ab05bd7213b90d9b002")
    ]);
}

function link(id: string, status: "PENDING" | "SUBMITTED", collaboratorId: string) {
  return {
    _id: new ObjectId(id),
    collaboratorId,
    documentTypeId,
    status,
    deletedAt: null,
    unlinkedAt: null,
    versions: [{version: 1, payload: "preserved"}]
  };
}

function labeledError(label: string): Error & {hasErrorLabel(candidate: string): boolean} {
  const error = new Error(label) as Error & {hasErrorLabel(candidate: string): boolean};
  error.hasErrorLabel = (candidate) => candidate === label;
  return error;
}

function sessionHarness(
  injected: MongoTransactionTestHarness,
  failCommit = false
): {session: ClientSession; commitCalls: {count: number}} {
  let inTransaction = false;
  const commitCalls = {count: 0};
  const session = {
    startTransaction() {
      inTransaction = true;
    },
    async commitTransaction() {
      commitCalls.count += 1;
      if (failCommit) {
        const failure = injected.nextFailure();
        if (failure) throw labeledError(failure);
      }
      inTransaction = false;
    },
    async abortTransaction() {
      inTransaction = false;
    },
    async endSession() {},
    inTransaction() {
      return inTransaction;
    }
  } as unknown as ClientSession;
  return {session, commitCalls};
}

function transactionManager(session: ClientSession): MongoTransactionManager {
  const connection = {readyState: 1, startSession: async () => session} as unknown as Connection;
  return new MongoTransactionManager({get: () => connection} as never);
}
