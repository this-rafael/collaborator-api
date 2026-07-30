import {ok} from "neverthrow";
import {describe, expect, it, vi} from "vitest";

import {CollaboratorDocumentUnlinkRepositoryStub} from "../../helpers/collaborator-document-runtime.js";

const unlinkUseCaseModule =
  "../../src/modules/collaborator-documents/application/use-cases/unlink-collaborator-document.use-case.js";

const id = "66a64ab05bd7213b90d9b001";
const now = new Date("2026-07-30T15:00:00.000Z");

describe("UnlinkCollaboratorDocumentUseCase", () => {
  it("unlinks an active document link using the injected clock", async () => {
    const module = await import(unlinkUseCaseModule);
    const repository = {
      unlinkActive: vi.fn().mockResolvedValue(ok(undefined))
    };
    const clock = {now: vi.fn(() => now)};

    const result = await new module.UnlinkCollaboratorDocumentUseCase(repository, clock).execute({
      id
    });

    expect(result.isOk()).toBe(true);
    expect(repository.unlinkActive).toHaveBeenCalledWith(id, now, now);
  });

  it.each([
    [
      "not-found",
      CollaboratorDocumentUnlinkRepositoryStub.notFound(),
      "COLLABORATOR_DOCUMENT_NOT_FOUND"
    ],
    [
      "unlinked",
      CollaboratorDocumentUnlinkRepositoryStub.alreadyUnlinked(),
      "COLLABORATOR_DOCUMENT_UNLINKED"
    ],
    ["deleted", CollaboratorDocumentUnlinkRepositoryStub.deleted(), "COLLABORATOR_DOCUMENT_DELETED"]
  ] as const)(
    "preserves the repository %s failure without a second mutation",
    async (_name, repository, code) => {
      const module = await import(unlinkUseCaseModule);
      const clock = {now: vi.fn(() => now)};

      const result = await new module.UnlinkCollaboratorDocumentUseCase(repository, clock).execute({
        id
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) expect(result.error.code).toBe(code);
    }
  );

  it("preserves persistence unavailability as a modeled failure", async () => {
    const module = await import(unlinkUseCaseModule);
    const result = await new module.UnlinkCollaboratorDocumentUseCase(
      CollaboratorDocumentUnlinkRepositoryStub.unavailable(),
      {now: () => now}
    ).execute({id});

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe("SERVICE_UNAVAILABLE");
  });
});
