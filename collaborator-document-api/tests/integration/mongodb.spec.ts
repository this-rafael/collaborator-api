import {afterAll, beforeAll, beforeEach, describe, expect, inject, it} from "vitest";
import {PlatformTest} from "@tsed/platform-http/testing";
import {MongooseService} from "@tsed/mongoose";

import {serverSettings, startApplication, stopApplication} from "../../src/bootstrap.js";
import {Server} from "../../src/Server.js";
import {MongoIndexManager} from "../../src/shared/infrastructure/persistence/mongodb/mongo-index-manager.js";
import {MongoTransactionManager} from "../../src/shared/infrastructure/persistence/mongodb/mongo-transaction-manager.js";
import {resetDatabase} from "../helpers/database.js";

describe("MongoDB integration", () => {
  const mongoUri = inject("mongoUri");

  beforeAll(
    PlatformTest.bootstrap(
      Server,
      serverSettings({nodeEnv: "test", port: 3000, mongodbUri: mongoUri, logLevel: "error"})
    )
  );
  afterAll(PlatformTest.reset);

  beforeEach(async () => {
    const db = PlatformTest.get<MongooseService>(MongooseService).get()?.db;
    if (!db) {
      throw new Error("MongoDB connection was not initialized for the integration test");
    }
    await resetDatabase(db);
  });

  it("connects and commits a transaction", async () => {
    const transaction = PlatformTest.get<MongoTransactionManager>(MongoTransactionManager);
    const db = PlatformTest.get<MongooseService>(MongooseService).get()?.db;
    await transaction.execute(async (session) => {
      await db!.collection("foundation").insertOne({state: "committed"}, {session});
    });
    expect(await db!.collection("foundation").countDocuments()).toBe(1);
  });

  it("aborts all writes when work fails", async () => {
    const transaction = PlatformTest.get<MongoTransactionManager>(MongoTransactionManager);
    const db = PlatformTest.get<MongooseService>(MongooseService).get()?.db;
    await expect(
      transaction.execute(async (session) => {
        await db!.collection("foundation").insertOne({state: "aborted"}, {session});
        throw new Error("expected failure");
      })
    ).rejects.toThrow("expected failure");
    expect(await db!.collection("foundation").countDocuments()).toBe(0);
  });

  it("creates and verifies indexes", async () => {
    const indexes = PlatformTest.get<MongoIndexManager>(MongoIndexManager);
    await indexes.ensure("foundation", [
      {key: {email: 1}, name: "foundation_email_unique", unique: true}
    ]);
    expect((await indexes.list("foundation")).map((index) => index.name)).toContain(
      "foundation_email_unique"
    );
  });

  it("starts and stops the real application lifecycle", async () => {
    const platform = await startApplication({
      nodeEnv: "test",
      port: 3101,
      mongodbUri: mongoUri,
      logLevel: "error"
    });
    await stopApplication(platform);
  });
});
