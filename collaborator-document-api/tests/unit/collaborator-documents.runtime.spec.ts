import {ok} from "neverthrow";
import {describe, expect, it, vi} from "vitest";

import {CollaboratorDocumentsRuntime} from "../../src/modules/collaborator-documents/collaborator-documents.runtime.js";
import type {TransactionContext} from "../../src/shared/application/ports/transaction-manager.js";

const documentTypeId = "66a64ab05bd7213b90d9b002";
const deletedAt = "2026-07-29T12:00:00.000Z";
const context = {} as TransactionContext;

describe("CollaboratorDocumentsRuntime", () => {
  it("delegates a valid document-type cascade to the repository", async () => {
    const repository = {
      softDeleteActiveByCollaboratorId: vi.fn(() => Promise.resolve(ok(undefined))),
      softDeleteActiveByDocumentTypeId: vi.fn(() => Promise.resolve(ok(undefined)))
    };

    const result = await new CollaboratorDocumentsRuntime(
      repository as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never
    ).executeByDocumentType({documentTypeId, deletedAt}, context);

    expect(result.isOk()).toBe(true);
    expect(repository.softDeleteActiveByDocumentTypeId).toHaveBeenCalledWith(
      documentTypeId,
      new Date(deletedAt),
      context
    );
  });

  it.each([
    [undefined],
    [{documentTypeId: 1, deletedAt}],
    [{documentTypeId, deletedAt: 1}],
    [{documentTypeId: "", deletedAt}],
    [{documentTypeId, deletedAt: "not-a-date"}]
  ])("returns a modeled failure for invalid document-type cascade input: %o", async (input) => {
    const repository = {
      softDeleteActiveByCollaboratorId: vi.fn(() => Promise.resolve(ok(undefined))),
      softDeleteActiveByDocumentTypeId: vi.fn(() => Promise.resolve(ok(undefined)))
    };

    const result = await new CollaboratorDocumentsRuntime(
      repository as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never
    ).executeByDocumentType(input as never, context);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(repository.softDeleteActiveByDocumentTypeId).not.toHaveBeenCalled();
  });

  it("delegates execute to the soft-delete use case", async () => {
    const repository = {
      softDeleteActiveByCollaboratorId: vi.fn(() => Promise.resolve(ok(undefined))),
      softDeleteActiveByDocumentTypeId: vi.fn(() => Promise.resolve(ok(undefined)))
    };
    const collaboratorId = "66a64ab05bd7213b90d9b001";

    const result = await new CollaboratorDocumentsRuntime(
      repository as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never
    ).execute({collaboratorId, deletedAt}, context);

    expect(result.isOk()).toBe(true);
    expect(repository.softDeleteActiveByCollaboratorId).toHaveBeenCalledWith(
      collaboratorId,
      new Date(deletedAt),
      context
    );
  });
});
