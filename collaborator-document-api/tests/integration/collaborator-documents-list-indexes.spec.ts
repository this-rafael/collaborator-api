import {beforeEach, describe, expect, it} from "vitest";
import {MongooseService} from "@tsed/mongoose";
import {PlatformTest} from "@tsed/platform-http/testing";

import {resetDatabase} from "../helpers/database.js";
import {bootstrapHttpMongo, httpDatabase} from "../helpers/http-mongo.js";

describe("Collaborator document list indexes", () => {
  bootstrapHttpMongo();

  beforeEach(async () => resetDatabase(httpDatabase()));

  it("provisions keyset indexes for the list filters and stable _id ordering", async () => {
    const modulePath =
      "../../src/modules/collaborator-documents/infrastructure/persistence/mongodb/collaborator-document.indexes.js";
    const module = await import(modulePath);
    const mongoose = PlatformTest.get<MongooseService>(MongooseService);

    const result = await module.ensureCollaboratorDocumentIndexes(mongoose);
    expect(result.isOk()).toBe(true);

    const indexes = await httpDatabase()
      .collection("collaborator_documents")
      .listIndexes()
      .toArray();
    expect(indexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({key: {collaboratorId: 1, _id: 1}}),
        expect.objectContaining({key: {documentTypeId: 1, _id: 1}})
      ])
    );
  });
});
