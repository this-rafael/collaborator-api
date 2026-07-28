import {describe, expect, it} from "vitest";

import {MongoIndexManager} from "../../src/shared/infrastructure/persistence/mongodb/mongo-index-manager.js";
import {MongoTransactionManager} from "../../src/shared/infrastructure/persistence/mongodb/mongo-transaction-manager.js";

describe("FND-MONGO-GUARDS", () => {
  it("FND-MONGO-005 reports a missing connection for transactions", async () => {
    const manager = new MongoTransactionManager({get: () => undefined} as never);
    await expect(manager.execute(async () => undefined)).rejects.toThrow(
      "MongoDB connection is not available"
    );
  });

  it("FND-MONGO-006 reports a missing connection for indexes", async () => {
    const manager = new MongoIndexManager({get: () => undefined} as never);
    await expect(manager.list("foundation")).rejects.toThrow("MongoDB connection is not available");
  });
});
