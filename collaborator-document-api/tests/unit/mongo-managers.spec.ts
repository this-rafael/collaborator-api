import {beforeEach, describe, expect, it, vi} from "vitest";

import {MongoIndexManager} from "../../src/shared/infrastructure/persistence/mongodb/mongo-index-manager.js";
import {MongoTransactionManager} from "../../src/shared/infrastructure/persistence/mongodb/mongo-transaction-manager.js";

const mongooseServiceGet = vi.hoisted(() => vi.fn());

vi.mock("@tsed/di", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tsed/di")>();
  return {
    ...actual,
    injector: () => ({
      get: () => ({
        get: mongooseServiceGet
      })
    })
  };
});

describe("Mongo manager guards", () => {
  it("reports a missing connection for transactions", async () => {
    const manager = new MongoTransactionManager({get: () => undefined} as never);
    await expect(manager.execute(async () => undefined)).rejects.toThrow(
      "MongoDB connection is not available"
    );
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

describe("requireMongooseConnection", () => {
  beforeEach(() => {
    mongooseServiceGet.mockReset();
  });

  it("throws when the mongoose connection is missing", async () => {
    mongooseServiceGet.mockReturnValue(undefined);
    const {requireMongooseConnection} =
      await import("../../src/shared/infrastructure/mongo/mongoose-connection.js");
    expect(() => requireMongooseConnection()).toThrow("MongoDB connection is not available");
  });

  it("throws when the connection readyState is not connected", async () => {
    mongooseServiceGet.mockReturnValue({readyState: 0});
    const {requireMongooseConnection} =
      await import("../../src/shared/infrastructure/mongo/mongoose-connection.js");
    expect(() => requireMongooseConnection()).toThrow("MongoDB connection is not available");
  });

  it("returns the connection when ready", async () => {
    const connection = {readyState: 1};
    mongooseServiceGet.mockReturnValue(connection);
    const {requireMongooseConnection} =
      await import("../../src/shared/infrastructure/mongo/mongoose-connection.js");
    expect(requireMongooseConnection()).toBe(connection);
  });
});
