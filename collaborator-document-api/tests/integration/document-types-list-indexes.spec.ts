import {beforeEach, describe, expect, it} from "vitest";
import {ObjectId} from "mongodb";
import {PlatformTest} from "@tsed/platform-http/testing";

import {resetDatabase} from "../helpers/database.js";
import {bootstrapHttpMongo, httpDatabase} from "../helpers/http-mongo.js";

// TYPE-LIST-006, TYPE-LIST-007, TYPE-LIST-008
describe("Document type keyset indexes", () => {
  bootstrapHttpMongo();
  beforeEach(async () => resetDatabase(httpDatabase()));

  it("provisions active ascending id support for keyset pagination", async () => {
    const {DocumentTypeIndexProvisioner} =
      await import("../../src/modules/document-types/infrastructure/persistence/mongodb/document-type.indexes.js");
    const provisioner = PlatformTest.get<{
      ensure(): Promise<{isOk(): boolean}>;
    }>(DocumentTypeIndexProvisioner);
    expect((await provisioner.ensure()).isOk()).toBe(true);

    const indexes = await httpDatabase().collection("document_types").listIndexes().toArray();
    expect(indexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: {_id: 1},
          partialFilterExpression: {deletedAt: null}
        })
      ])
    );
  });

  it("returns active rows strictly after the last key in ascending order", async () => {
    const collection = httpDatabase().collection("document_types");
    const now = new Date("2026-07-30T12:00:00.000Z");
    await collection.insertMany(
      ["010", "011", "012"].map((suffix) => ({
        _id: new ObjectId(`66a64ab05bd7213b90d9b${suffix}`),
        name: `Tipo ${suffix}`,
        nameNormalized: `tipo ${suffix}`,
        code: `TYPE_${suffix}`,
        description: null,
        deletedAt: null,
        createdAt: now,
        updatedAt: now
      }))
    );
    const cursorId = new ObjectId("66a64ab05bd7213b90d9b010");
    const page = await collection
      .find({_id: {$gt: cursorId}, deletedAt: null})
      .sort({_id: 1})
      .limit(1)
      .toArray();
    expect(page.map(({_id}) => _id.toHexString())).toEqual(["66a64ab05bd7213b90d9b011"]);
  });
});
