import {ok} from "neverthrow";
import {describe, expect, it} from "vitest";

import {MongoIndexManager} from "../../src/shared/infrastructure/persistence/mongodb/mongo-index-manager.js";
import {MongoTransactionManager} from "../../src/shared/infrastructure/persistence/mongodb/mongo-transaction-manager.js";

describe("Mongo manager guards", () => {
  it("returns a modeled unavailable failure when transactions have no connection", async () => {
    const manager = new MongoTransactionManager({get: () => undefined} as never);
    const result = await manager.execute(() => Promise.resolve(ok(undefined)));

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe("SERVICE_UNAVAILABLE");
  });

  it("reports a missing connection for indexes", async () => {
    const manager = new MongoIndexManager({get: () => undefined} as never);
    await expect(manager.list("foundation")).rejects.toThrow("MongoDB connection is not available");
  });

  it("reports a missing database handle for indexes", async () => {
    const manager = new MongoIndexManager({get: () => ({})} as never);
    await expect(manager.list("foundation")).rejects.toThrow("MongoDB database is not available");
  });
});
