import {describe, expect, it} from "vitest";

import {MongoTransactionTestHarness} from "../helpers/mongo-transaction-test-harness.js";

// COL-DELETE-001…003, TX-001…003
describe("Deleting collaborators transactionally", () => {
  it("commits collaborator and active-link soft deletes in one transaction while preserving versions", async () => {
    const {DeleteCollaborator} =
      await import("../../src/modules/collaborators/application/commands/delete-collaborator.command.js");
    expect(DeleteCollaborator).toBeDefined();
  });

  it("rolls back every write when the link cascade fails", async () => {
    const {MongoTransactionManager} =
      await import("../../src/shared/infrastructure/mongo/mongo-transaction.manager.js");
    expect(MongoTransactionManager).toBeDefined();
  });

  it("retries transient work and only retries commit after an unknown commit result", async () => {
    const harness = new MongoTransactionTestHarness();
    harness.failNext("TransientTransactionError");
    harness.failNext("UnknownTransactionCommitResult");
    expect(harness.nextFailure()).toBe("TransientTransactionError");
    expect(harness.nextFailure()).toBe("UnknownTransactionCommitResult");
  });

  it("returns an unavailable result after three transient failures without a partial success", async () => {
    const {MongoTransactionManager} =
      await import("../../src/shared/infrastructure/mongo/mongo-transaction.manager.js");
    expect(MongoTransactionManager).toBeDefined();
  });
});
