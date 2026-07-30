import mongoose from "mongoose";
import {MongooseService} from "@tsed/mongoose";
import {PlatformTest} from "@tsed/platform-http/testing";
import {afterAll, beforeAll, inject} from "vitest";
import type {Db} from "mongodb";

import {serverSettings} from "../../src/bootstrap.js";
import {Server} from "../../src/Server.js";
import {CollaboratorIndexProvisioner} from "../../src/modules/collaborators/infrastructure/persistence/mongodb/collaborator.indexes.js";

type BootstrapHttpMongoOptions = {
  beforeBootstrap?: () => void | Promise<void>;
};

/**
 * Boots Ts.ED against the Testcontainers mongoUri and tears
 * down Mongoose + PlatformTest so Vitest can exit cleanly.
 */
export function bootstrapHttpMongo(options: BootstrapHttpMongoOptions = {}): void {
  const mongoUri = inject("mongoUri");
  beforeAll(async () => {
    await options.beforeBootstrap?.();
    await PlatformTest.bootstrap(
      Server,
      serverSettings({nodeEnv: "test", port: 3000, mongodbUri: mongoUri, logLevel: "error"})
    )();
    const indexes = await PlatformTest.get<CollaboratorIndexProvisioner>(
      CollaboratorIndexProvisioner
    ).ensure();
    if (indexes.isErr()) {
      throw new Error(`COLLABORATOR_INDEX_PROVISIONING_FAILED:${indexes.error.code}`);
    }
  });
  afterAll(async () => {
    try {
      const mongooseService = PlatformTest.get<MongooseService>(MongooseService);
      await mongooseService.closeConnections();
    } catch {
      // Platform may already be torn down; fall through to disconnect/reset.
    }
    try {
      await mongoose.disconnect();
    } catch {
      // Default connection may already be closed.
    }
    await PlatformTest.reset();
  });
}

export function httpDatabase(): Db {
  const database = PlatformTest.get<MongooseService>(MongooseService).get()?.db;
  if (!database) throw new Error("MongoDB connection was not initialized for the HTTP test");
  return database;
}
