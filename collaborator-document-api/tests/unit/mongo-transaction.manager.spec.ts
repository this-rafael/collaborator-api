import type {ClientSession, Connection} from "mongoose";
import {describe, expect, it} from "vitest";

import {
  classifyMongoTransactionError,
  MongoTransactionManager
} from "../../src/shared/infrastructure/mongo/mongo-transaction.manager.js";

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
  setCommitImpl: (impl: () => Promise<void>) => void;
};

const createSessionHarness = (): SessionHarness => {
  let inTxn = false;
  const abortCalls = {count: 0};
  const commitCalls = {count: 0};
  const endCalls = {count: 0};
  let commitImpl: () => Promise<void> = async () => {
    inTxn = false;
  };

  const session = {
    startTransaction() {
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
    setCommitImpl(impl) {
      commitImpl = impl;
    }
  };
};

const createConnection = (session: ClientSession): Connection =>
  ({
    startSession: async () => session
  }) as unknown as Connection;

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
  it("runs work and commits on the happy path", async () => {
    const harness = createSessionHarness();
    const manager = new MongoTransactionManager(createConnection(harness.session));
    const result = await manager.runInTransaction(async () => "ok");

    expect(result).toBe("ok");
    expect(harness.commitCalls.count).toBe(1);
    expect(harness.abortCalls.count).toBe(0);
    expect(harness.endCalls.count).toBe(1);
    expect(manager.mongoTransactionRetriesTotal).toBe(0);
  });

  it("aborts, retries TransientTransactionError, and increments the retry counter", async () => {
    const harness = createSessionHarness();
    const manager = new MongoTransactionManager(createConnection(harness.session));
    let attempts = 0;

    const result = await manager.runInTransaction(async () => {
      attempts += 1;
      if (attempts === 1) throw labeledError("TransientTransactionError");
      return "recovered";
    });

    expect(result).toBe("recovered");
    expect(attempts).toBe(2);
    expect(harness.abortCalls.count).toBe(1);
    expect(harness.commitCalls.count).toBe(1);
    expect(manager.mongoTransactionRetriesTotal).toBe(1);
    expect(harness.endCalls.count).toBe(1);
  });

  it("rethrows TransientTransactionError after the third attempt", async () => {
    const harness = createSessionHarness();
    const manager = new MongoTransactionManager(createConnection(harness.session));
    let attempts = 0;
    const failure = labeledError("TransientTransactionError", "still transient");

    await expect(
      manager.runInTransaction(async () => {
        attempts += 1;
        throw failure;
      })
    ).rejects.toBe(failure);

    expect(attempts).toBe(3);
    expect(harness.abortCalls.count).toBe(3);
    expect(manager.mongoTransactionRetriesTotal).toBe(2);
    expect(harness.endCalls.count).toBe(1);
  });

  it("retries UnknownTransactionCommitResult on commit then succeeds", async () => {
    const harness = createSessionHarness();
    let commitAttempts = 0;
    harness.setCommitImpl(async () => {
      commitAttempts += 1;
      if (commitAttempts === 1) throw labeledError("UnknownTransactionCommitResult");
    });
    const manager = new MongoTransactionManager(createConnection(harness.session));

    const result = await manager.runInTransaction(async () => "committed");

    expect(result).toBe("committed");
    expect(harness.commitCalls.count).toBe(2);
    expect(manager.mongoTransactionRetriesTotal).toBe(1);
    expect(harness.abortCalls.count).toBe(0);
    expect(harness.endCalls.count).toBe(1);
  });

  it("does not retry non-labeled errors", async () => {
    const harness = createSessionHarness();
    const manager = new MongoTransactionManager(createConnection(harness.session));
    let attempts = 0;
    const failure = new Error("business failure");

    await expect(
      manager.runInTransaction(async () => {
        attempts += 1;
        throw failure;
      })
    ).rejects.toBe(failure);

    expect(attempts).toBe(1);
    expect(harness.abortCalls.count).toBe(1);
    expect(manager.mongoTransactionRetriesTotal).toBe(0);
    expect(harness.endCalls.count).toBe(1);
  });

  it("rethrows UnknownTransactionCommitResult after the third commit attempt", async () => {
    const harness = createSessionHarness();
    const failure = labeledError("UnknownTransactionCommitResult", "commit unknown");
    harness.setCommitImpl(async () => {
      throw failure;
    });
    const manager = new MongoTransactionManager(createConnection(harness.session));

    await expect(manager.runInTransaction(async () => "never")).rejects.toBe(failure);
    expect(harness.commitCalls.count).toBe(3);
    expect(manager.mongoTransactionRetriesTotal).toBe(2);
    expect(harness.endCalls.count).toBe(1);
  });

  it("skips abort when the session is no longer in a transaction", async () => {
    const harness = createSessionHarness();
    const manager = new MongoTransactionManager(createConnection(harness.session));
    const failure = new Error("already aborted");

    await expect(
      manager.runInTransaction(async (session) => {
        await session.abortTransaction();
        throw failure;
      })
    ).rejects.toBe(failure);

    expect(harness.abortCalls.count).toBe(1);
    expect(harness.endCalls.count).toBe(1);
  });
});
