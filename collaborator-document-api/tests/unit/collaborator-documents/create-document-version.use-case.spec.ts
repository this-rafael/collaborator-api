import {describe, expect, it} from "vitest";

import {
  documentVersionFixture,
  documentVersionMetadataFixture
} from "../../helpers/collaborator-document-fixtures.js";
import {CollaboratorDocumentVersionRepositoryStub} from "../../helpers/collaborator-document-runtime.js";

const createVersionUseCaseModule =
  "../../../src/modules/collaborator-documents/application/use-cases/create-document-version.use-case.js";

const id = "66a64ab05bd7213b90d9c001";
const now = new Date("2026-07-30T15:00:00.000Z");
const metadata = documentVersionMetadataFixture();

describe("Creating a document version through the application", () => {
  // VER-CREATE-001 / VER-CREATE-003 / VER-CREATE-004 / VER-CREATE-005
  it("delegates an accepted submission with a single clock instant", async () => {
    const module = await import(createVersionUseCaseModule);
    const version = documentVersionFixture({submittedAt: now.toISOString()});
    const repository = CollaboratorDocumentVersionRepositoryStub.success(version);

    const result = await new module.CreateDocumentVersionUseCase(repository, {
      now: () => now
    }).execute({id, metadata});

    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value).toEqual(version);
    expect(repository.calls).toEqual([{id, metadata, submittedAt: now}]);
  });

  // VER-CREATE-026 / VER-CREATE-027 / VER-CREATE-028 / VER-CREATE-031 / VER-CREATE-033
  it.each([
    [
      "a missing document",
      CollaboratorDocumentVersionRepositoryStub.notFound(),
      "COLLABORATOR_DOCUMENT_NOT_FOUND"
    ],
    [
      "an unlinked document",
      CollaboratorDocumentVersionRepositoryStub.alreadyUnlinked(),
      "COLLABORATOR_DOCUMENT_UNLINKED"
    ],
    [
      "a deleted document",
      CollaboratorDocumentVersionRepositoryStub.deleted(),
      "COLLABORATOR_DOCUMENT_DELETED"
    ],
    [
      "an exhausted history",
      CollaboratorDocumentVersionRepositoryStub.historyLimitReached(),
      "DOCUMENT_HISTORY_LIMIT_REACHED"
    ],
    [
      "an unavailable dependency",
      CollaboratorDocumentVersionRepositoryStub.unavailable(),
      "SERVICE_UNAVAILABLE"
    ]
  ] as const)("preserves the modeled failure for %s", async (_description, repository, code) => {
    const module = await import(createVersionUseCaseModule);
    const result = await new module.CreateDocumentVersionUseCase(repository, {
      now: () => now
    }).execute({id, metadata});

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe(code);
  });

  // VER-CREATE-030
  it("maps a clock failure to a modeled internal error without persistence", async () => {
    const module = await import(createVersionUseCaseModule);
    const repository = CollaboratorDocumentVersionRepositoryStub.success();
    const result = await new module.CreateDocumentVersionUseCase(repository, {
      now: () => {
        throw new Error("clock unavailable");
      }
    }).execute({id, metadata});

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(repository.calls).toEqual([]);
  });

  it("maps an unexpected repository rejection to a modeled internal error", async () => {
    const module = await import(createVersionUseCaseModule);
    const repository = {
      appendVersion: async () => {
        throw new Error("unexpected persistence rejection");
      }
    };

    const result = await new module.CreateDocumentVersionUseCase(repository, {
      now: () => now
    }).execute({id, metadata});

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe("INTERNAL_SERVER_ERROR");
  });
});
