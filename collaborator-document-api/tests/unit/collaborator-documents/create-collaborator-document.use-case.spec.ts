import {describe, expect, it} from "vitest";

import {linkPendingFixture} from "../../helpers/collaborator-document-fixtures.js";
import {
  CollaboratorDocumentRepositoryStub,
  CollaboratorStatusReaderStub,
  DocumentTypeStatusReaderStub
} from "../../helpers/collaborator-document-runtime.js";

const createUseCaseModule =
  "../../../src/modules/collaborator-documents/application/use-cases/create-collaborator-document.use-case.js";

const clock = {now: () => new Date("2026-07-30T12:00:00.000Z")};
const ids = {next: () => "66a64ab05bd7213b90d9c001"};
const input = {
  collaboratorId: "66a64ab05bd7213b90d9b001",
  documentTypeId: "66a64ab05bd7213b90d9b010"
};

describe("CreateCollaboratorDocumentUseCase", () => {
  it("returns an active PENDING link after valid creation", async () => {
    const module = await import(createUseCaseModule);
    const fixture = linkPendingFixture();
    const result = await new module.CreateCollaboratorDocumentUseCase(
      CollaboratorDocumentRepositoryStub.success(fixture),
      CollaboratorStatusReaderStub.success(),
      DocumentTypeStatusReaderStub.success(),
      clock,
      ids
    ).execute(input);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toMatchObject({
        id: fixture.id,
        status: "PENDING",
        currentVersion: 0,
        unlinkedAt: null,
        deletedAt: null
      });
    }
  });

  it("preserves collaborator not-found failures", async () => {
    const module = await import(createUseCaseModule);
    const result = await new module.CreateCollaboratorDocumentUseCase(
      CollaboratorDocumentRepositoryStub.success(),
      CollaboratorStatusReaderStub.notFound(),
      DocumentTypeStatusReaderStub.success(),
      clock,
      ids
    ).execute(input);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe("COLLABORATOR_NOT_FOUND");
  });

  it("preserves collaborator deleted failures", async () => {
    const module = await import(createUseCaseModule);
    const result = await new module.CreateCollaboratorDocumentUseCase(
      CollaboratorDocumentRepositoryStub.success(),
      CollaboratorStatusReaderStub.deleted(),
      DocumentTypeStatusReaderStub.success(),
      clock,
      ids
    ).execute(input);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe("COLLABORATOR_DELETED");
  });

  it("preserves document type not-found failures", async () => {
    const module = await import(createUseCaseModule);
    const result = await new module.CreateCollaboratorDocumentUseCase(
      CollaboratorDocumentRepositoryStub.success(),
      CollaboratorStatusReaderStub.success(),
      DocumentTypeStatusReaderStub.notFound(),
      clock,
      ids
    ).execute(input);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe("DOCUMENT_TYPE_NOT_FOUND");
  });

  it("preserves document type deleted failures", async () => {
    const module = await import(createUseCaseModule);
    const result = await new module.CreateCollaboratorDocumentUseCase(
      CollaboratorDocumentRepositoryStub.success(),
      CollaboratorStatusReaderStub.success(),
      DocumentTypeStatusReaderStub.deleted(),
      clock,
      ids
    ).execute(input);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe("DOCUMENT_TYPE_DELETED");
  });

  it("preserves active duplicate failures", async () => {
    const module = await import(createUseCaseModule);
    const result = await new module.CreateCollaboratorDocumentUseCase(
      CollaboratorDocumentRepositoryStub.duplicate(),
      CollaboratorStatusReaderStub.success(),
      DocumentTypeStatusReaderStub.success(),
      clock,
      ids
    ).execute(input);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe("ACTIVE_LINK_ALREADY_EXISTS");
  });

  it("preserves persistence unavailability as a modeled failure", async () => {
    const module = await import(createUseCaseModule);
    const result = await new module.CreateCollaboratorDocumentUseCase(
      CollaboratorDocumentRepositoryStub.unavailable(),
      CollaboratorStatusReaderStub.success(),
      DocumentTypeStatusReaderStub.success(),
      clock,
      ids
    ).execute(input);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe("SERVICE_UNAVAILABLE");
  });

  it("maps dependency and domain creation failures", async () => {
    const module = await import(createUseCaseModule);
    const dependencyFailure = await new module.CreateCollaboratorDocumentUseCase(
      CollaboratorDocumentRepositoryStub.success(),
      CollaboratorStatusReaderStub.success(),
      DocumentTypeStatusReaderStub.success(),
      {
        now: () => {
          throw new Error("clock failed");
        }
      },
      ids
    ).execute(input);
    const domainFailure = await new module.CreateCollaboratorDocumentUseCase(
      CollaboratorDocumentRepositoryStub.success(),
      CollaboratorStatusReaderStub.success(),
      DocumentTypeStatusReaderStub.success(),
      clock,
      {next: () => "not-an-object-id"}
    ).execute(input);

    expect(dependencyFailure.isErr()).toBe(true);
    if (dependencyFailure.isErr()) {
      expect(dependencyFailure.error.code).toBe("INTERNAL_SERVER_ERROR");
    }
    expect(domainFailure.isErr()).toBe(true);
    if (domainFailure.isErr()) expect(domainFailure.error.code).toBe("VALIDATION_ERROR");
  });
});
