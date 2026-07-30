import type {ClientSession, Connection} from "mongoose";
import {errAsync, okAsync} from "neverthrow";
import {describe, expect, it} from "vitest";

import {
  classifyMongoTransactionError,
  MongoTransactionManager
} from "../../src/shared/infrastructure/persistence/mongodb/mongo-transaction-manager.js";
import {getMongoSession} from "../../src/shared/infrastructure/persistence/mongodb/mongo-transaction-context.js";

const labeledError = (
  label: string,
  message = label
): Error & {hasErrorLabel: (candidate: string) => boolean} => {
  const error = new Error(message) as Error & {hasErrorLabel: (candidate: string) => boolean};
  error.hasErrorLabel = (candidate) => candidate === label;
  return error;
};

type SessionHarness = {
  session: ClientSession;
  abortCalls: {count: number};
  commitCalls: {count: number};
  endCalls: {count: number};
  startCalls: {count: number};
  setCommitImpl: (impl: () => Promise<void>) => void;
};

const createSessionHarness = (): SessionHarness => {
  let inTxn = false;
  const abortCalls = {count: 0};
  const commitCalls = {count: 0};
  const endCalls = {count: 0};
  const startCalls = {count: 0};
  let commitImpl: () => Promise<void> = async () => {
    inTxn = false;
  };

  const session = {
    startTransaction() {
      startCalls.count += 1;
      inTxn = true;
    },
    async commitTransaction() {
      commitCalls.count += 1;
      await commitImpl();
    },
    async abortTransaction() {
      abortCalls.count += 1;
      inTxn = false;
    },
    async endSession() {
      endCalls.count += 1;
    },
    inTransaction() {
      return inTxn;
    }
  } as unknown as ClientSession;

  return {
    session,
    abortCalls,
    commitCalls,
    endCalls,
    startCalls,
    setCommitImpl(impl) {
      commitImpl = impl;
    }
  };
};

const createConnection = (session: ClientSession): Connection =>
  ({readyState: 1, startSession: async () => session}) as unknown as Connection;

const createManager = (session: ClientSession): MongoTransactionManager =>
  new MongoTransactionManager({get: () => createConnection(session)} as never);

describe("classifyMongoTransactionError", () => {
  it("returns TRANSIENT for TransientTransactionError", () => {
    expect(classifyMongoTransactionError(labeledError("TransientTransactionError"))).toBe(
      "TRANSIENT"
    );
  });

  it("returns UNKNOWN_COMMIT for UnknownTransactionCommitResult", () => {
    expect(classifyMongoTransactionError(labeledError("UnknownTransactionCommitResult"))).toBe(
      "UNKNOWN_COMMIT"
    );
  });

  it("returns OTHER for unlabeled or non-object errors", () => {
    expect(classifyMongoTransactionError(new Error("plain"))).toBe("OTHER");
    expect(classifyMongoTransactionError("string-error")).toBe("OTHER");
    expect(classifyMongoTransactionError(null)).toBe("OTHER");
  });
});

describe("MongoTransactionManager", () => {
  it("runs work through an opaque context and commits on the happy path", async () => {
    const harness = createSessionHarness();
    const manager = createManager(harness.session);
    let receivedSession: ClientSession | undefined;
    const result = await manager.execute((context) => {
      receivedSession = getMongoSession(context);
      return okAsync("ok");
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value).toBe("ok");
    expect(receivedSession).toBe(harness.session);
    expect(harness.startCalls.count).toBe(1);
    expect(harness.commitCalls.count).toBe(1);
    expect(harness.abortCalls.count).toBe(0);
    expect(harness.endCalls.count).toBe(1);
    expect(manager.mongoTransactionRetriesTotal).toBe(0);
  });

  it("aborts, retries TransientTransactionError, and increments the retry counter", async () => {
    const harness = createSessionHarness();
    const manager = createManager(harness.session);
    let attempts = 0;

    const result = await manager.execute(() => {
      attempts += 1;
      if (attempts === 1) throw labeledError("TransientTransactionError");
      return okAsync("recovered");
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value).toBe("recovered");
    expect(attempts).toBe(2);
    expect(harness.abortCalls.count).toBe(1);
    expect(harness.commitCalls.count).toBe(1);
    expect(manager.mongoTransactionRetriesTotal).toBe(1);
    expect(harness.endCalls.count).toBe(1);
  });

  it("returns SERVICE_UNAVAILABLE after the third transient attempt", async () => {
    const harness = createSessionHarness();
    const manager = createManager(harness.session);
    let attempts = 0;
    const result = await manager.execute<never, never>(() => {
      attempts += 1;
      throw labeledError("TransientTransactionError", "still transient");
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe("SERVICE_UNAVAILABLE");
    expect(attempts).toBe(3);
    expect(harness.abortCalls.count).toBe(3);
    expect(manager.mongoTransactionRetriesTotal).toBe(2);
    expect(harness.endCalls.count).toBe(1);
  });

  it("retries only commit after UnknownTransactionCommitResult", async () => {
    const harness = createSessionHarness();
    let commitAttempts = 0;
    harness.setCommitImpl(async () => {
      commitAttempts += 1;
      if (commitAttempts === 1) throw labeledError("UnknownTransactionCommitResult");
    });
    const manager = createManager(harness.session);
    let workCalls = 0;

    const result = await manager.execute(() => {
      workCalls += 1;
      return okAsync("committed");
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value).toBe("committed");
    expect(workCalls).toBe(1);
    expect(harness.commitCalls.count).toBe(2);
    expect(manager.mongoTransactionRetriesTotal).toBe(1);
    expect(harness.abortCalls.count).toBe(0);
    expect(harness.endCalls.count).toBe(1);
  });

  it("returns INTERNAL_SERVER_ERROR for a non-labeled technical error", async () => {
    const harness = createSessionHarness();
    const manager = createManager(harness.session);
    let attempts = 0;
    const result = await manager.execute<never, never>(() => {
      attempts += 1;
      throw new Error("technical failure");
    });

    expect(attempts).toBe(1);
    expect(harness.abortCalls.count).toBe(1);
    expect(manager.mongoTransactionRetriesTotal).toBe(0);
    expect(harness.endCalls.count).toBe(1);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe("INTERNAL_SERVER_ERROR");
  });

  it("returns SERVICE_UNAVAILABLE after the third unknown commit result", async () => {
    const harness = createSessionHarness();
    harness.setCommitImpl(async () => {
      throw labeledError("UnknownTransactionCommitResult", "commit unknown");
    });
    const manager = createManager(harness.session);

    const result = await manager.execute(() => okAsync("never"));
    expect(harness.commitCalls.count).toBe(3);
    expect(manager.mongoTransactionRetriesTotal).toBe(2);
    expect(harness.endCalls.count).toBe(1);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe("SERVICE_UNAVAILABLE");
  });

  it("aborts a modeled work failure without retrying it", async () => {
    const harness = createSessionHarness();
    const manager = createManager(harness.session);
    const failure = {kind: "domain" as const, code: "RULE", message: "Regra violada"};
    const result = await manager.execute(() => errAsync(failure));

    expect(harness.abortCalls.count).toBe(1);
    expect(harness.endCalls.count).toBe(1);
    expect(manager.mongoTransactionRetriesTotal).toBe(0);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error).toBe(failure);
  });

  it("returns SERVICE_UNAVAILABLE when no usable connection exists", async () => {
    const manager = new MongoTransactionManager({get: () => undefined} as never);
    const result = await manager.execute(() => okAsync("never"));

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe("SERVICE_UNAVAILABLE");
  });
});
