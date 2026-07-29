import {ok} from "neverthrow";
import {describe, expect, it} from "vitest";

import {Collaborator} from "../../src/modules/collaborators/domain/collaborator.js";

const activeCollaborator = Collaborator.reconstitute({
  ...Collaborator.create({
    name: "Ana Silva",
    cpf: "12345678909",
    email: "ana@example.com"
  })._unsafeUnwrap().props,
  id: "66a64ab05bd7213b90d9b001"
});

describe("DeleteCollaborator transaction failures", () => {
  it("maps a generic transaction throw to INTERNAL_SERVER_ERROR", async () => {
    const {DeleteCollaborator} =
      await import("../../src/modules/collaborators/application/commands/delete-collaborator.command.js");

    const repository = {
      findById: async () => ok(activeCollaborator),
      softDeleteActive: async () => true
    };
    const documents = {
      softDeleteActiveByCollaboratorId: async () => undefined
    };
    const transactions = {
      runInTransaction: async () => {
        throw new Error("commit failed");
      }
    };

    const result = await new DeleteCollaborator(
      repository as never,
      documents,
      transactions as never
    ).execute("66a64ab05bd7213b90d9b001");

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe("INTERNAL_SERVER_ERROR");
  });

  it("maps MongoServerSelectionError to SERVICE_UNAVAILABLE", async () => {
    const {DeleteCollaborator} =
      await import("../../src/modules/collaborators/application/commands/delete-collaborator.command.js");

    const repository = {
      findById: async () => ok(activeCollaborator),
      softDeleteActive: async () => true
    };
    const documents = {
      softDeleteActiveByCollaboratorId: async () => undefined
    };
    const transactions = {
      runInTransaction: async () => {
        const error = new Error("server selection timed out");
        error.name = "MongoServerSelectionError";
        throw error;
      }
    };

    const result = await new DeleteCollaborator(
      repository as never,
      documents,
      transactions as never
    ).execute("66a64ab05bd7213b90d9b001");

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe("SERVICE_UNAVAILABLE");
  });
});
