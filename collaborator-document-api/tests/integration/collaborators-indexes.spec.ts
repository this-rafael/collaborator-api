import {beforeEach, describe, expect, it} from "vitest";
import {ObjectId} from "mongodb";
import {PlatformTest} from "@tsed/platform-http/testing";

import {CollaboratorIndexProvisioner} from "../../src/modules/collaborators/infrastructure/persistence/mongodb/collaborator.indexes.js";
import {resetDatabase} from "../helpers/database.js";
import {bootstrapHttpMongo, httpDatabase} from "../helpers/http-mongo.js";

const historicalId = "66a64ab05bd7213b90d9b010";
const activeId = "66a64ab05bd7213b90d9b011";

describe("Collaborator persistence indexes", () => {
  bootstrapHttpMongo();

  beforeEach(async () => resetDatabase(httpDatabase()));

  it("provisions partial unique indexes, preserves history, and rejects active duplicates", async () => {
    const db = httpDatabase();
    const provisioner = PlatformTest.get<CollaboratorIndexProvisioner>(
      CollaboratorIndexProvisioner
    );
    const provisioned = await provisioner.ensure();

    expect(provisioned.isOk()).toBe(true);
    const indexes = await db.collection("collaborators").listIndexes().toArray();
    expect(indexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "collaborators_active_cpf_unique",
          unique: true,
          partialFilterExpression: {deletedAt: null}
        }),
        expect.objectContaining({
          name: "collaborators_active_email_unique",
          unique: true,
          partialFilterExpression: {deletedAt: null}
        }),
        expect.objectContaining({
          name: "collaborators_active_keyset",
          partialFilterExpression: {deletedAt: null}
        })
      ])
    );

    const now = new Date("2026-07-29T12:00:00.000Z");
    await db.collection("collaborators").insertMany([
      collaboratorRow(historicalId, {
        cpf: "12345678909",
        email: "historical@example.com",
        deletedAt: now
      }),
      collaboratorRow(activeId, {
        cpf: "12345678909",
        email: "historical@example.com",
        deletedAt: null
      })
    ]);

    await expect(
      db.collection("collaborators").insertOne(
        collaboratorRow("66a64ab05bd7213b90d9b012", {
          cpf: "12345678909",
          email: "another@example.com",
          deletedAt: null
        })
      )
    ).rejects.toMatchObject({code: 11_000});
    await expect(
      db.collection("collaborators").insertOne(
        collaboratorRow("66a64ab05bd7213b90d9b013", {
          cpf: "98765432100",
          email: "historical@example.com",
          deletedAt: null
        })
      )
    ).rejects.toMatchObject({code: 11_000});
  });
});

function collaboratorRow(
  id: string,
  input: Readonly<{cpf: string; email: string; deletedAt: Date | null}>
) {
  const now = new Date("2026-07-29T12:00:00.000Z");
  return {
    _id: new ObjectId(id),
    name: "Ana Silva",
    nameNormalized: "ana silva",
    cpf: input.cpf,
    email: input.email,
    deletedAt: input.deletedAt,
    createdAt: now,
    updatedAt: now
  };
}
