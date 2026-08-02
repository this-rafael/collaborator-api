import {beforeEach, describe, expect, it, vi} from "vitest";
import {ObjectId} from "mongodb";
import {PlatformTest} from "@tsed/platform-http/testing";
import type {TransactionContext} from "../../src/shared/application/ports/transaction-manager.js";

import {CollaboratorDocumentsRuntime} from "../../src/modules/collaborator-documents/collaborator-documents.runtime.js";
import {CollaboratorsRuntime} from "../../src/modules/collaborators/collaborators.runtime.js";
import {DocumentTypesRuntime} from "../../src/modules/document-types/document-types.runtime.js";
import {MongoCollaboratorRepository} from "../../src/modules/collaborators/infrastructure/persistence/mongodb/collaborator.mongo-repository.js";
import {MongoDocumentTypeRepository} from "../../src/modules/document-types/infrastructure/persistence/mongodb/document-type.mongo-repository.js";
import {resetDatabase} from "../helpers/database.js";
import {bootstrapHttpMongo, httpDatabase} from "../helpers/http-mongo.js";

const collaboratorId = "66a64ab05bd7213b90d9b001";
const documentTypeId = "66a64ab05bd7213b90d9b010";

describe("Creating a link while a parent is deleted", () => {
  bootstrapHttpMongo();

  beforeEach(async () => resetDatabase(httpDatabase()));

  // BDD gap: LINK-CREATE and parent DELETE scenarios do not define their concurrent interleaving.
  it("cascades a link created while its collaborator deletion is waiting", async () => {
    await seedActiveParents();
    const reservation = pauseReservation(
      PlatformTest.get<MongoCollaboratorRepository>(MongoCollaboratorRepository)
    );

    const created = PlatformTest.get<CollaboratorDocumentsRuntime>(
      CollaboratorDocumentsRuntime
    ).application.create.execute({collaboratorId, documentTypeId});
    await reservation.reached;

    const deleted = PlatformTest.get<CollaboratorsRuntime>(
      CollaboratorsRuntime
    ).application.delete.execute({id: collaboratorId});
    reservation.release();

    const [createResult, deleteResult] = await Promise.all([created, deleted]);
    expect(createResult.isOk()).toBe(true);
    expect(deleteResult.isOk()).toBe(true);
    if (!createResult.isOk()) return;

    const database = httpDatabase();
    const collaborator = await database
      .collection("collaborators")
      .findOne({_id: new ObjectId(collaboratorId)});
    const link = await database
      .collection("collaborator_documents")
      .findOne({_id: new ObjectId(createResult.value.id)});

    expect(collaborator?.deletedAt).toBeInstanceOf(Date);
    expect(link?.deletedAt).toEqual(collaborator?.deletedAt);
  });

  it("cascades a link created while its document type deletion is waiting", async () => {
    await seedActiveParents();
    const reservation = pauseReservation(
      PlatformTest.get<MongoDocumentTypeRepository>(MongoDocumentTypeRepository)
    );

    const created = PlatformTest.get<CollaboratorDocumentsRuntime>(
      CollaboratorDocumentsRuntime
    ).application.create.execute({collaboratorId, documentTypeId});
    await reservation.reached;

    const deleted = PlatformTest.get<DocumentTypesRuntime>(
      DocumentTypesRuntime
    ).application.delete.execute({id: documentTypeId});
    reservation.release();

    const [createResult, deleteResult] = await Promise.all([created, deleted]);
    expect(createResult.isOk()).toBe(true);
    expect(deleteResult.isOk()).toBe(true);
    if (!createResult.isOk()) return;

    const database = httpDatabase();
    const documentType = await database
      .collection("document_types")
      .findOne({_id: new ObjectId(documentTypeId)});
    const link = await database
      .collection("collaborator_documents")
      .findOne({_id: new ObjectId(createResult.value.id)});

    expect(documentType?.deletedAt).toBeInstanceOf(Date);
    expect(link?.deletedAt).toEqual(documentType?.deletedAt);
  });
});

function pauseReservation(repository: {
  reserveActiveForDocumentLink(id: string, context: TransactionContext): Promise<unknown>;
}): {reached: Promise<void>; release(): void} {
  let signalReached!: () => void;
  let continueReservation!: () => void;
  const reached = new Promise<void>((resolve) => {
    signalReached = resolve;
  });
  const wait = new Promise<void>((resolve) => {
    continueReservation = resolve;
  });
  const original = repository.reserveActiveForDocumentLink.bind(repository);
  vi.spyOn(repository, "reserveActiveForDocumentLink").mockImplementation(async (...args) => {
    const result = await original(...args);
    signalReached();
    await wait;
    return result;
  });
  return {reached, release: continueReservation};
}

async function seedActiveParents(): Promise<void> {
  const database = httpDatabase();
  const now = new Date("2026-08-02T12:00:00.000Z");
  await database.collection("collaborators").insertOne({
    _id: new ObjectId(collaboratorId),
    name: "Ana Silva",
    nameNormalized: "ana silva",
    cpf: "12345678909",
    email: "ana@example.com",
    createdAt: now,
    updatedAt: now,
    deletedAt: null
  });
  await database.collection("document_types").insertOne({
    _id: new ObjectId(documentTypeId),
    name: "Atestado",
    nameNormalized: "atestado",
    code: "ASO",
    description: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null
  });
}
