import {describe, expect, it} from "vitest";

import {CollaboratorRepositoryStub} from "../helpers/collaborator-runtime.js";

// COL-CREATE-001, COL-CREATE-021, COL-CREATE-022
describe("Creating a collaborator in the application layer", () => {
  it("returns Ok with an active collaborator after valid creation", async () => {
    const {CreateCollaborator} =
      await import("../../src/modules/collaborators/application/commands/create-collaborator.command.js");
    const result = await new CreateCollaborator(new CollaboratorRepositoryStub()).execute({
      name: "Ana Silva",
      cpf: "12345678909",
      email: "ana@example.com"
    });
    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value.deletedAt).toBeNull();
  });

  it("returns Err instead of throwing for duplicate records", async () => {
    const {CreateCollaborator} =
      await import("../../src/modules/collaborators/application/commands/create-collaborator.command.js");
    const result = await new CreateCollaborator(CollaboratorRepositoryStub.duplicateCpf()).execute({
      name: "Ana Silva",
      cpf: "12345678909",
      email: "ana@example.com"
    });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe("DUPLICATE_ACTIVE_CPF");
  });

  it("returns the domain validation code without calling the repository", async () => {
    const {CreateCollaborator} =
      await import("../../src/modules/collaborators/application/commands/create-collaborator.command.js");
    let repositoryCalled = false;
    const repository = {
      create: async () => {
        repositoryCalled = true;
        throw new Error("must not be called");
      }
    };
    const result = await new CreateCollaborator(repository).execute({
      name: "",
      cpf: "12345678909",
      email: "ana@example.com"
    });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe("VALIDATION_ERROR");
    expect(repositoryCalled).toBe(false);
  });
});

describe("Collaborator.create fail branches", () => {
  it("rejects invalid name, cpf and email", async () => {
    const {Collaborator} = await import("../../src/modules/collaborators/domain/collaborator.js");

    const invalidName = Collaborator.create({
      name: "",
      cpf: "12345678909",
      email: "ana@example.com"
    });
    expect(invalidName.isErr()).toBe(true);
    if (invalidName.isErr()) expect(invalidName.error.code).toBe("VALIDATION_ERROR");

    const invalidCpf = Collaborator.create({
      name: "Ana Silva",
      cpf: "123",
      email: "ana@example.com"
    });
    expect(invalidCpf.isErr()).toBe(true);
    if (invalidCpf.isErr()) expect(invalidCpf.error.code).toBe("VALIDATION_ERROR");

    const invalidEmail = Collaborator.create({
      name: "Ana Silva",
      cpf: "12345678909",
      email: "not-an-email"
    });
    expect(invalidEmail.isErr()).toBe(true);
    if (invalidEmail.isErr()) expect(invalidEmail.error.code).toBe("VALIDATION_ERROR");
  });
});
