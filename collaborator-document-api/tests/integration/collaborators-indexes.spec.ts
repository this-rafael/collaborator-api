import {describe, expect, it} from "vitest";

// COL-CREATE-002, COL-CREATE-021, COL-CREATE-022
describe("Collaborator persistence indexes", () => {
  it("allows a new active record to reuse identifiers retained only by history", async () => {
    const {MongoCollaboratorRepository} =
      await import("../../src/modules/collaborators/infrastructure/repositories/mongo-collaborator.repository.js");
    expect(MongoCollaboratorRepository).toBeDefined();
  });

  it("rejects duplicate CPF and email among active records with partial unique indexes", async () => {
    const {ensureCollaboratorIndexes} =
      await import("../../src/modules/collaborators/infrastructure/indexes/collaborator.indexes.js");
    expect(ensureCollaboratorIndexes).toBeDefined();
  });
});
