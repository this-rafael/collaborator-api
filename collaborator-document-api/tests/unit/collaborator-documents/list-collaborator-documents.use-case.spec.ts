import {ok} from "neverthrow";
import {describe, expect, it, vi} from "vitest";

import {
  collaboratorDocumentPageFixtures,
  linkPendingFixture
} from "../../helpers/collaborator-document-fixtures.js";

const listUseCaseModule =
  "../../../src/modules/collaborator-documents/application/use-cases/list-collaborator-documents.use-case.js";

describe("ListCollaboratorDocumentsUseCase", () => {
  it("applies active lifecycle by default and returns a modeled page", async () => {
    const module = await import(listUseCaseModule);
    const repository = {
      list: vi.fn().mockResolvedValue(ok({items: [linkPendingFixture()], hasNext: false}))
    };

    const result = await new module.ListCollaboratorDocumentsUseCase(repository).execute({
      filters: {},
      limit: 20
    });

    expect(result.isOk()).toBe(true);
    expect(repository.list).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: expect.objectContaining({lifecycle: "active"}),
        limit: 20
      })
    );
  });

  it("preserves an empty page without manufacturing collection items", async () => {
    const module = await import(listUseCaseModule);
    const repository = {
      list: vi.fn().mockResolvedValue(ok({items: [], hasNext: false}))
    };

    const result = await new module.ListCollaboratorDocumentsUseCase(repository).execute({
      filters: {},
      limit: 20
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value.items).toEqual([]);
    expect(repository.list).toHaveBeenCalledTimes(1);
  });

  it("passes keyset position and normalized filters to persistence", async () => {
    const module = await import(listUseCaseModule);
    const repository = {
      list: vi
        .fn()
        .mockResolvedValue(ok({items: collaboratorDocumentPageFixtures(2), hasNext: true}))
    };

    const result = await new module.ListCollaboratorDocumentsUseCase(repository).execute({
      filters: {
        collaboratorId: "66a64ab05bd7213b90d9b001",
        documentTypeId: "66a64ab05bd7213b90d9b010",
        status: "PENDING",
        lifecycle: "active"
      },
      limit: 2,
      afterId: "66a64ab05bd7213b90d9d001"
    });

    expect(result.isOk()).toBe(true);
    expect(repository.list).toHaveBeenCalledWith(
      expect.objectContaining({
        afterId: "66a64ab05bd7213b90d9d001",
        limit: 2
      })
    );
  });

  it("rejects invalid filters before calling persistence", async () => {
    const module = await import(listUseCaseModule);
    const repository = {list: vi.fn()};

    const result = await new module.ListCollaboratorDocumentsUseCase(repository).execute({
      filters: {collaboratorId: "bad", status: "NOPE", lifecycle: "weird"},
      limit: 20
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe("INVALID_QUERY_PARAMETER");
    expect(repository.list).not.toHaveBeenCalled();
  });
});
