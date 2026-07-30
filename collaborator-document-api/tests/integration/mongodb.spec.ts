import {afterAll, beforeAll, beforeEach, describe, expect, inject, it} from "vitest";
import {PlatformTest} from "@tsed/platform-http/testing";
import {MongooseService} from "@tsed/mongoose";
import {err, ok, type Result} from "neverthrow";
import {MongoClient, type Db} from "mongodb";

import {serverSettings, startApplication, stopApplication} from "../../src/bootstrap.js";
import {Server} from "../../src/Server.js";
import {applicationFailure} from "../../src/shared/application/errors/application-failure.js";
import type {TransactionContext} from "../../src/shared/application/ports/transaction-manager.js";
import {MongoIndexManager} from "../../src/shared/infrastructure/persistence/mongodb/mongo-index-manager.js";
import {getMongoSession} from "../../src/shared/infrastructure/persistence/mongodb/mongo-transaction-context.js";
import {MongoTransactionManager} from "../../src/shared/infrastructure/persistence/mongodb/mongo-transaction-manager.js";
import {resetDatabase} from "../helpers/database.js";

const insertFoundation = async (
  db: Db,
  context: TransactionContext,
  state: string
): Promise<Result<void, ReturnType<typeof applicationFailure>>> => {
  const session = getMongoSession(context);
  if (!session) {
    return err(applicationFailure("INTERNAL_SERVER_ERROR", "Sessão MongoDB ausente."));
  }
  try {
    await db.collection("foundation").insertOne({state}, {session});
    return ok(undefined);
  } catch {
    return err(applicationFailure("SERVICE_UNAVAILABLE", "MongoDB indisponível."));
  }
};

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
    const result = await transaction.execute((context) =>
      insertFoundation(db!, context, "committed")
    );

    expect(result.isOk()).toBe(true);
    expect(await db!.collection("foundation").countDocuments()).toBe(1);
  });

  it("aborts all writes when work returns a modeled failure", async () => {
    const transaction = PlatformTest.get<MongoTransactionManager>(MongoTransactionManager);
    const db = PlatformTest.get<MongooseService>(MongooseService).get()?.db;
    const result = await transaction.execute(async (context) => {
      const inserted = await insertFoundation(db!, context, "aborted");
      if (inserted.isErr()) return inserted;
      return err(applicationFailure("VALIDATION_ERROR", "Falha esperada."));
    });

    expect(result.isErr()).toBe(true);
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

  it("starts the real lifecycle only after provisioning collaborator indexes", async () => {
    const platform = await startApplication({
      nodeEnv: "test",
      port: 3101,
      mongodbUri: mongoUri,
      logLevel: "error"
    });
    try {
      const client = new MongoClient(mongoUri);
      await client.connect();
      try {
        const indexNames = (
          await client.db().collection("collaborators").listIndexes().toArray()
        ).map(({name}) => name);
        expect(indexNames).toEqual(
          expect.arrayContaining([
            "collaborators_active_cpf_unique",
            "collaborators_active_email_unique",
            "collaborators_active_keyset"
          ])
        );
      } finally {
        await client.close();
      }
    } finally {
      await stopApplication(platform);
    }
  });
});
