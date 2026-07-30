import {errAsync, okAsync} from "neverthrow";
import {describe, expect, it} from "vitest";

import type {TransactionContext} from "../../src/shared/application/ports/transaction-manager.js";
import {Collaborator} from "../../src/modules/collaborators/domain/entities/collaborator.js";

const id = "66a64ab05bd7213b90d9b001";
const clock = {now: () => new Date("2026-07-29T12:00:00.000Z")};
const activeCollaborator = Collaborator.create(
  {id, name: "Ana Silva", cpf: "12345678909", email: "ana@example.com"},
  clock.now()
)._unsafeUnwrap();

describe("DeleteCollaboratorUseCase", () => {
  it("uses the public document cascade in the opaque transaction", async () => {
    const {DeleteCollaboratorUseCase} =
      await import("../../src/modules/collaborators/application/use-cases/delete-collaborator.use-case.js");
    let transactionContext: TransactionContext | undefined;
    let cascadeInput: {collaboratorId: string; deletedAt: string} | undefined;
    const repository = {
      findById: () => okAsync(activeCollaborator),
      softDeleteActive: (_collaborator: Collaborator, context: TransactionContext) => {
        transactionContext = context;
        return okAsync(true);
      }
    };
    const documents = {
      execute: (
        input: {collaboratorId: string; deletedAt: string},
        context: TransactionContext
      ) => {
        cascadeInput = input;
        expect(context).toBe(transactionContext);
        return okAsync(undefined);
      }
    };
    const transactions = {
      execute: (work: (context: TransactionContext) => ReturnType<typeof okAsync>) =>
        work({} as TransactionContext)
    };

    const result = await new DeleteCollaboratorUseCase(
      repository,
      documents,
      transactions as never,
      clock
    ).execute({id});

    expect(result.isOk()).toBe(true);
    expect(cascadeInput?.collaboratorId).toBe(id);
    expect(cascadeInput?.deletedAt).toBe("2026-07-29T12:00:00.000Z");
  });

  it("propagates a modeled transaction failure without inspecting thrown Mongo errors", async () => {
    const {DeleteCollaboratorUseCase} =
      await import("../../src/modules/collaborators/application/use-cases/delete-collaborator.use-case.js");
    const repository = {
      findById: () => okAsync(activeCollaborator),
      softDeleteActive: () => okAsync(true)
    };
    const documents = {execute: () => okAsync(undefined)};
    const transactions = {
      execute: () =>
        errAsync({
          kind: "application" as const,
          code: "SERVICE_UNAVAILABLE" as const,
          message: "Transaction unavailable."
        })
    };

    const result = await new DeleteCollaboratorUseCase(
      repository,
      documents,
      transactions as never,
      clock
    ).execute({id});

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe("SERVICE_UNAVAILABLE");
  });

  it("does not persist or cascade when the clock is unavailable", async () => {
    const {DeleteCollaboratorUseCase} =
      await import("../../src/modules/collaborators/application/use-cases/delete-collaborator.use-case.js");
    let persisted = false;
    let cascaded = false;
    const repository = {
      findById: () => okAsync(activeCollaborator),
      softDeleteActive: () => {
        persisted = true;
        return okAsync(true);
      }
    };
    const documents = {
      execute: () => {
        cascaded = true;
        return okAsync(undefined);
      }
    };
    const transactions = {execute: () => okAsync(undefined)};

    const result = await new DeleteCollaboratorUseCase(
      repository,
      documents,
      transactions as never,
      {
        now: () => {
          throw new Error("clock unavailable");
        }
      }
    ).execute({id});

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(persisted).toBe(false);
    expect(cascaded).toBe(false);
  });

  it("does not cascade when a concurrent delete already made the aggregate inactive", async () => {
    const {DeleteCollaboratorUseCase} =
      await import("../../src/modules/collaborators/application/use-cases/delete-collaborator.use-case.js");
    let cascaded = false;
    const repository = {
      findById: () => okAsync(activeCollaborator),
      softDeleteActive: () => okAsync(false)
    };
    const documents = {
      execute: () => {
        cascaded = true;
        return okAsync(undefined);
      }
    };
    const transactions = {
      execute: (work: (context: TransactionContext) => ReturnType<typeof okAsync>) =>
        work({} as TransactionContext)
    };

    const result = await new DeleteCollaboratorUseCase(
      repository,
      documents,
      transactions as never,
      clock
    ).execute({id});

    expect(result.isOk()).toBe(true);
    expect(cascaded).toBe(false);
  });

  it("maps document cascade failures into the collaborator application failure contract", async () => {
    const {DeleteCollaboratorUseCase} =
      await import("../../src/modules/collaborators/application/use-cases/delete-collaborator.use-case.js");
    const repository = {
      findById: () => okAsync(activeCollaborator),
      softDeleteActive: () => okAsync(true)
    };
    const documents = {
      execute: () =>
        errAsync({
          kind: "application" as const,
          code: "SERVICE_UNAVAILABLE" as const,
          message: "Document cascade unavailable."
        })
    };
    const transactions = {
      execute: (work: (context: TransactionContext) => ReturnType<typeof errAsync>) =>
        work({} as TransactionContext)
    };

    const result = await new DeleteCollaboratorUseCase(
      repository,
      documents,
      transactions as never,
      clock
    ).execute({id});

    expect(result.isErr()).toBe(true);
    if (result.isErr())
      expect(result.error).toMatchObject({
        kind: "application",
        code: "SERVICE_UNAVAILABLE",
        message: "Document cascade unavailable."
      });
  });
});
