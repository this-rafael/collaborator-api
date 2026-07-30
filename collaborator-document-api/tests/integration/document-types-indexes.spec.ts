import {beforeEach, describe, expect, it} from "vitest";
import {ObjectId} from "mongodb";
import {PlatformTest} from "@tsed/platform-http/testing";

import {resetDatabase} from "../helpers/database.js";
import {bootstrapHttpMongo, httpDatabase} from "../helpers/http-mongo.js";

// TYPE-CREATE-004, TYPE-CREATE-022
describe("Document type persistence indexes", () => {
  bootstrapHttpMongo();
  beforeEach(async () => resetDatabase(httpDatabase()));

  it("provisions an active-code partial unique index and allows historical reuse", async () => {
    const {DocumentTypeIndexProvisioner} =
      await import("../../src/modules/document-types/infrastructure/persistence/mongodb/document-type.indexes.js");
    const provisioner = PlatformTest.get<{
      ensure(): Promise<{isOk(): boolean}>;
    }>(DocumentTypeIndexProvisioner);
    expect((await provisioner.ensure()).isOk()).toBe(true);

    const collection = httpDatabase().collection("document_types");
    const indexes = await collection.listIndexes().toArray();
    expect(indexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: {code: 1},
          unique: true,
          partialFilterExpression: {deletedAt: null}
        })
      ])
    );

    const deletedAt = new Date("2026-07-30T13:00:00.000Z");
    await collection.insertOne(row("66a64ab05bd7213b90d9b010", "ASO", deletedAt));
    await collection.insertOne(row("66a64ab05bd7213b90d9b011", "ASO", null));
    await expect(
      collection.insertOne(row("66a64ab05bd7213b90d9b012", "ASO", null))
    ).rejects.toMatchObject({code: 11_000});
    expect(await collection.countDocuments({code: "ASO"})).toBe(2);
  });
});

function row(id: string, code: string, deletedAt: Date | null) {
  const now = new Date("2026-07-30T12:00:00.000Z");
  return {
    _id: new ObjectId(id),
    name: `Tipo ${code}`,
    nameNormalized: `tipo ${code.toLowerCase()}`,
    code,
    description: null,
    deletedAt,
    createdAt: now,
    updatedAt: now
  };
}
