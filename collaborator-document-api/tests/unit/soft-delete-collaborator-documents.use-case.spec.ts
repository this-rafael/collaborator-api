import {errAsync, okAsync} from "neverthrow";
import {describe, expect, it, vi} from "vitest";

import type {TransactionContext} from "../../src/shared/application/ports/transaction-manager.js";
import {
  collaboratorDocumentsFailure,
  type CollaboratorDocumentsFailure
} from "../../src/modules/collaborator-documents/application/contracts/soft-delete-collaborator-documents.input.js";
import {SoftDeleteCollaboratorDocumentsUseCase} from "../../src/modules/collaborator-documents/application/use-cases/soft-delete-collaborator-documents.use-case.js";

const collaboratorId = "66a64ab05bd7213b90d9b001";
const deletedAt = "2026-07-29T12:00:00.000Z";
const context = {} as TransactionContext;

describe("SoftDeleteCollaboratorDocumentsUseCase", () => {
  it("parses the public cascade input and delegates it in the same transaction", async () => {
    const repository = {
      softDeleteActiveByCollaboratorId: vi.fn(() => okAsync(undefined))
    };

    const result = await new SoftDeleteCollaboratorDocumentsUseCase(repository).execute(
      {collaboratorId, deletedAt},
      context
    );

    expect(result.isOk()).toBe(true);
    expect(repository.softDeleteActiveByCollaboratorId).toHaveBeenCalledWith(
      collaboratorId,
      new Date(deletedAt),
      context
    );
  });

  it.each([
    [undefined],
    [{collaboratorId: 1, deletedAt}],
    [{collaboratorId, deletedAt: 1}],
    [{collaboratorId: "", deletedAt}],
    [{collaboratorId, deletedAt: "not-a-date"}]
  ])("returns a modeled failure for invalid cascade input: %o", async (input) => {
    const repository = {
      softDeleteActiveByCollaboratorId: vi.fn(() => okAsync(undefined))
    };

    const result = await new SoftDeleteCollaboratorDocumentsUseCase(repository).execute(
      input as never,
      context
    );

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(repository.softDeleteActiveByCollaboratorId).not.toHaveBeenCalled();
  });

  it("preserves a modeled persistence failure", async () => {
    const failure: CollaboratorDocumentsFailure = collaboratorDocumentsFailure(
      "SERVICE_UNAVAILABLE",
      "Collaborator document persistence is unavailable."
    );
    const repository = {
      softDeleteActiveByCollaboratorId: vi.fn(() => errAsync(failure))
    };

    const result = await new SoftDeleteCollaboratorDocumentsUseCase(repository).execute(
      {collaboratorId, deletedAt},
      context
    );

    expect(result).toMatchObject({error: failure});
  });
});
