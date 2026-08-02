import {err, ok} from "neverthrow";
import {describe, expect, it, vi} from "vitest";

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
const transactions = {
  execute: async (work: (context: never) => Promise<unknown>) => work({} as never)
};
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
      transactions as never,
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
      transactions as never,
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
      transactions as never,
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
      transactions as never,
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
      transactions as never,
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
      transactions as never,
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
      transactions as never,
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
      transactions as never,
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
      transactions as never,
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

  // BDD gap: LINK-CREATE and parent DELETE scenarios do not specify their interleaving.
  it("reserves both active parents and inserts the link in the same transaction", async () => {
    const module = await import(createUseCaseModule);
    const fixture = linkPendingFixture();
    const context = {};
    const calls: string[] = [];
    const transactions = {
      execute: vi.fn(async (work: (received: object) => Promise<unknown>) => {
        calls.push("transaction");
        return work(context);
      })
    };
    const collaborators = {
      reserveActive: vi.fn(async (_id: string, received: object) => {
        calls.push("collaborator");
        expect(received).toBe(context);
        return ok("ACTIVE" as const);
      })
    };
    const documentTypes = {
      reserveActive: vi.fn(async (_id: string, received: object) => {
        calls.push("documentType");
        expect(received).toBe(context);
        return ok("ACTIVE" as const);
      })
    };
    const repository = {
      create: vi.fn(async (_document: unknown, received: object) => {
        calls.push("create");
        expect(received).toBe(context);
        return ok(fixture);
      })
    };

    const result = await new module.CreateCollaboratorDocumentUseCase(
      repository as never,
      collaborators as never,
      documentTypes as never,
      transactions as never,
      clock,
      ids
    ).execute(input);

    expect(result.isOk()).toBe(true);
    expect(calls).toEqual(["transaction", "collaborator", "documentType", "create"]);
    expect(transactions.execute).toHaveBeenCalledTimes(1);
  });

  it("returns transaction failures without reserving a parent or inserting a link", async () => {
    const module = await import(createUseCaseModule);
    const reserveActive = vi.fn();
    const create = vi.fn();
    const transactions = {
      execute: vi.fn(async () =>
        err({
          kind: "application" as const,
          code: "SERVICE_UNAVAILABLE" as const,
          message: "MongoDB is unavailable."
        })
      )
    };

    const result = await new module.CreateCollaboratorDocumentUseCase(
      {create} as never,
      {reserveActive} as never,
      {reserveActive} as never,
      transactions as never,
      clock,
      ids
    ).execute(input);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe("SERVICE_UNAVAILABLE");
    expect(reserveActive).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });
});
