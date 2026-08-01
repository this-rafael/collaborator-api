import {describe, expect, it} from "vitest";

import {documentVersionGetFixture} from "../../helpers/collaborator-document-fixtures.js";
import {CollaboratorDocumentVersionGetRepositoryStub} from "../../helpers/collaborator-document-runtime.js";

const getDocumentVersionUseCaseModule =
  "../../../src/modules/collaborator-documents/application/use-cases/get-document-version.use-case.js";

const id = "66a64ab05bd7213b90d9d201";

describe("Getting a document version through the application", () => {
  it("delegates the exact document and version lookup and preserves the modeled resource", async () => {
    const module = await import(getDocumentVersionUseCaseModule);
    const version = documentVersionGetFixture();
    const repository = CollaboratorDocumentVersionGetRepositoryStub.success(version);

    const result = await new module.GetDocumentVersionUseCase(repository).execute({id, version: 2});

    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value).toEqual(version);
    expect(repository.calls).toEqual([{id, version: 2}]);
  });

  it.each([
    [
      "a missing document",
      CollaboratorDocumentVersionGetRepositoryStub.documentNotFound(),
      "COLLABORATOR_DOCUMENT_NOT_FOUND"
    ],
    [
      "a missing version",
      CollaboratorDocumentVersionGetRepositoryStub.versionNotFound(),
      "DOCUMENT_VERSION_NOT_FOUND"
    ],
    [
      "an internal persistence failure",
      CollaboratorDocumentVersionGetRepositoryStub.internalError(),
      "INTERNAL_SERVER_ERROR"
    ],
    [
      "an unavailable dependency",
      CollaboratorDocumentVersionGetRepositoryStub.unavailable(),
      "SERVICE_UNAVAILABLE"
    ]
  ] as const)("preserves the modeled failure for %s", async (_description, repository, code) => {
    const module = await import(getDocumentVersionUseCaseModule);
    const result = await new module.GetDocumentVersionUseCase(repository).execute({id, version: 2});

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe(code);
    expect(repository.calls).toEqual([{id, version: 2}]);
  });
});
