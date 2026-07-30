import {ok} from "neverthrow";
import {describe, expect, it} from "vitest";

import {CollaboratorRepositoryStub} from "../helpers/collaborator-runtime.js";

const clock = {now: () => new Date("2026-07-29T12:00:00.000Z")};
const ids = {next: () => "66a64ab05bd7213b90d9b001"};
const input = {name: "Ana Silva", cpf: "12345678909", email: "ana@example.com"};

describe("CreateCollaboratorUseCase", () => {
  it("returns a primitive active output after valid creation", async () => {
    const {CreateCollaboratorUseCase} =
      await import("../../src/modules/collaborators/application/use-cases/create-collaborator.use-case.js");

    const result = await new CreateCollaboratorUseCase(
      new CollaboratorRepositoryStub(),
      clock,
      ids
    ).execute(input);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toMatchObject({id: ids.next(), deletedAt: null, name: "Ana Silva"});
      expect(result.value.createdAt).toBe("2026-07-29T12:00:00.000Z");
    }
  });

  it("preserves the modeled duplicate failure", async () => {
    const {CreateCollaboratorUseCase} =
      await import("../../src/modules/collaborators/application/use-cases/create-collaborator.use-case.js");

    const result = await new CreateCollaboratorUseCase(
      CollaboratorRepositoryStub.duplicateCpf(),
      clock,
      ids
    ).execute(input);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe("DUPLICATE_ACTIVE_CPF");
  });

  it("does not invoke persistence when the aggregate rejects input", async () => {
    const {CreateCollaboratorUseCase} =
      await import("../../src/modules/collaborators/application/use-cases/create-collaborator.use-case.js");
    let called = false;
    const repository = {
      create: () => {
        called = true;
        return Promise.resolve(ok(undefined as never));
      }
    };

    const result = await new CreateCollaboratorUseCase(repository, clock, ids).execute({
      ...input,
      name: ""
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe("VALIDATION_ERROR");
    expect(called).toBe(false);
  });

  it("returns a modeled internal failure when an injected dependency is unavailable", async () => {
    const {CreateCollaboratorUseCase} =
      await import("../../src/modules/collaborators/application/use-cases/create-collaborator.use-case.js");
    let called = false;
    const repository = {
      create: () => {
        called = true;
        return Promise.resolve(ok(undefined as never));
      }
    };

    const result = await new CreateCollaboratorUseCase(repository, clock, {
      next: () => {
        throw new Error("generator unavailable");
      }
    }).execute(input);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(called).toBe(false);
  });
});
