import {err, ok} from "neverthrow";
import {describe, expect, it} from "vitest";

import {Collaborator} from "../../../src/modules/collaborators/domain/entities/collaborator.js";

const clock = {now: () => new Date("2026-07-29T13:00:00.000Z")};
const id = "66a64ab05bd7213b90d9b001";

describe("UpdateCollaboratorUseCase", () => {
  it("updates only supplied fields through the aggregate", async () => {
    const {UpdateCollaboratorUseCase} =
      await import("../../../src/modules/collaborators/application/use-cases/update-collaborator.use-case.js");
    const existing = Collaborator.create(
      {id, name: "Ana Silva", cpf: "12345678909", email: "ana@example.com"},
      new Date("2026-07-29T12:00:00.000Z")
    )._unsafeUnwrap();
    let persisted: Collaborator | undefined;
    const repository = {
      findById: () => Promise.resolve(ok(existing)),
      updateActive: (collaborator: Collaborator) => {
        persisted = collaborator;
        return Promise.resolve(ok(collaborator));
      }
    };

    const result = await new UpdateCollaboratorUseCase(repository, clock).execute({
      id,
      patch: {name: "Ana Souza"}
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.name).toBe("Ana Souza");
      expect(result.value.updatedAt).toBe("2026-07-29T13:00:00.000Z");
    }
    expect(persisted?.props.cpf.value).toBe("12345678909");
    expect(existing.props.name.value).toBe("Ana Silva");
  });

  it("preserves duplicate failures from the write port", async () => {
    const {UpdateCollaboratorUseCase} =
      await import("../../../src/modules/collaborators/application/use-cases/update-collaborator.use-case.js");
    const existing = Collaborator.create(
      {id, name: "Ana Silva", cpf: "12345678909", email: "ana@example.com"},
      new Date("2026-07-29T12:00:00.000Z")
    )._unsafeUnwrap();
    const repository = {
      findById: () => Promise.resolve(ok(existing)),
      updateActive: () =>
        Promise.resolve(
          err({
            kind: "application" as const,
            code: "DUPLICATE_ACTIVE_EMAIL" as const,
            message: "Duplicate email."
          })
        )
    };

    const result = await new UpdateCollaboratorUseCase(repository, clock).execute({
      id,
      patch: {email: "ana2@example.com"}
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe("DUPLICATE_ACTIVE_EMAIL");
  });

  it("returns a modeled failure when the injected clock is unavailable", async () => {
    const {UpdateCollaboratorUseCase} =
      await import("../../../src/modules/collaborators/application/use-cases/update-collaborator.use-case.js");
    const existing = Collaborator.create(
      {id, name: "Ana Silva", cpf: "12345678909", email: "ana@example.com"},
      new Date("2026-07-29T12:00:00.000Z")
    )._unsafeUnwrap();
    let persisted = false;
    const repository = {
      findById: () => Promise.resolve(ok(existing)),
      updateActive: () => {
        persisted = true;
        return Promise.resolve(ok(existing));
      }
    };

    const result = await new UpdateCollaboratorUseCase(repository, {
      now: () => {
        throw new Error("clock unavailable");
      }
    }).execute({id, patch: {name: "Ana Souza"}});

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(persisted).toBe(false);
  });

  it("does not persist when the aggregate rejects the patch", async () => {
    const {UpdateCollaboratorUseCase} =
      await import("../../../src/modules/collaborators/application/use-cases/update-collaborator.use-case.js");
    const existing = Collaborator.create(
      {id, name: "Ana Silva", cpf: "12345678909", email: "ana@example.com"},
      new Date("2026-07-29T12:00:00.000Z")
    )._unsafeUnwrap();
    let persisted = false;
    const repository = {
      findById: () => Promise.resolve(ok(existing)),
      updateActive: () => {
        persisted = true;
        return Promise.resolve(ok(existing));
      }
    };

    const result = await new UpdateCollaboratorUseCase(repository, clock).execute({
      id,
      patch: {name: ""}
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe("VALIDATION_ERROR");
    expect(persisted).toBe(false);
  });
});
