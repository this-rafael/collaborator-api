import {describe, expect, it} from "vitest";

import {linkPendingFixture} from "../../helpers/collaborator-document-fixtures.js";
import {CollaboratorDocumentGetRepositoryStub} from "../../helpers/collaborator-document-runtime.js";

const getUseCaseModule =
  "../../../src/modules/collaborator-documents/application/use-cases/get-collaborator-document.use-case.js";

describe("GetCollaboratorDocumentUseCase", () => {
  it("returns an active PENDING link by id", async () => {
    const module = await import(getUseCaseModule);
    const fixture = linkPendingFixture();
    const repository = CollaboratorDocumentGetRepositoryStub.found(fixture);

    const result = await new module.GetCollaboratorDocumentUseCase(repository).execute({
      id: fixture.id
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value).toEqual(fixture);
  });

  it("preserves historical records returned by persistence", async () => {
    const module = await import(getUseCaseModule);
    const fixture = linkPendingFixture({unlinkedAt: "2026-07-30T13:00:00.000Z"});
    const repository = CollaboratorDocumentGetRepositoryStub.found(fixture);

    const result = await new module.GetCollaboratorDocumentUseCase(repository).execute({
      id: fixture.id
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value.unlinkedAt).toBe(fixture.unlinkedAt);
  });

  it("preserves a not-found repository failure", async () => {
    const module = await import(getUseCaseModule);
    const result = await new module.GetCollaboratorDocumentUseCase(
      CollaboratorDocumentGetRepositoryStub.notFound()
    ).execute({id: "66a64ab05bd7213b90d9b099"});

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe("COLLABORATOR_DOCUMENT_NOT_FOUND");
  });
});
