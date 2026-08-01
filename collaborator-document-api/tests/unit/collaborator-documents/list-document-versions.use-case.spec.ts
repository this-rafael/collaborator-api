import {describe, expect, it} from "vitest";

import {
  documentVersionHistoryFixtures,
  documentVersionListPageFixture
} from "../../helpers/collaborator-document-fixtures.js";
import {CollaboratorDocumentVersionListRepositoryStub} from "../../helpers/collaborator-document-runtime.js";

const listVersionsUseCaseModule =
  "../../../src/modules/collaborator-documents/application/use-cases/list-document-versions.use-case.js";

const id = "66a64ab05bd7213b90d9d101";

describe("Listing document versions through the application", () => {
  it("delegates descending keyset pagination and preserves the modeled page", async () => {
    const module = await import(listVersionsUseCaseModule);
    const page = documentVersionListPageFixture({
      items: documentVersionHistoryFixtures(2).reverse(),
      hasNext: true
    });
    const repository = CollaboratorDocumentVersionListRepositoryStub.success(page);

    const result = await new module.ListDocumentVersionsUseCase(repository).execute({
      id,
      order: "desc",
      limit: 2,
      afterVersion: 3
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value).toEqual(page);
    expect(repository.calls).toEqual([{id, order: "desc", limit: 2, afterVersion: 3}]);
  });

  it("preserves an empty history without manufacturing versions", async () => {
    const module = await import(listVersionsUseCaseModule);
    const page = documentVersionListPageFixture({items: [], currentVersion: 0});
    const repository = CollaboratorDocumentVersionListRepositoryStub.success(page);

    const result = await new module.ListDocumentVersionsUseCase(repository).execute({
      id,
      order: "asc",
      limit: 20
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value).toEqual(page);
    expect(repository.calls).toEqual([{id, order: "asc", limit: 20}]);
  });

  it.each([
    [
      "a missing document",
      CollaboratorDocumentVersionListRepositoryStub.notFound(),
      "COLLABORATOR_DOCUMENT_NOT_FOUND"
    ],
    [
      "an internal persistence failure",
      CollaboratorDocumentVersionListRepositoryStub.internalError(),
      "INTERNAL_SERVER_ERROR"
    ],
    [
      "an unavailable dependency",
      CollaboratorDocumentVersionListRepositoryStub.unavailable(),
      "SERVICE_UNAVAILABLE"
    ]
  ] as const)("preserves the modeled failure for %s", async (_description, repository, code) => {
    const module = await import(listVersionsUseCaseModule);
    const result = await new module.ListDocumentVersionsUseCase(repository).execute({
      id,
      order: "desc",
      limit: 20
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe(code);
  });

  it("maps an unexpected repository rejection to a modeled internal error", async () => {
    const module = await import(listVersionsUseCaseModule);
    const repository = {
      listVersions: async () => {
        throw new Error("unexpected persistence rejection");
      }
    };

    const result = await new module.ListDocumentVersionsUseCase(repository).execute({
      id,
      order: "desc",
      limit: 20
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe("INTERNAL_SERVER_ERROR");
  });
});
