import {describe, expect, it} from "vitest";

import {pendingDocumentPageFixtures} from "../../helpers/reporting-fixtures.js";
import {PendingDocumentsRepositoryStub} from "../../helpers/reporting-runtime.js";

const queryModulePath =
  "../../../src/modules/reporting/application/queries/list-pending-documents.query.js";

describe("ListPendingDocumentsQuery", () => {
  // QUERY-PENDING-001, QUERY-PENDING-002, QUERY-PENDING-003
  it("requests only current pending links and returns the hydrated read model", async () => {
    const module = await import(queryModulePath);
    const repository = PendingDocumentsRepositoryStub.success();

    const result = await new module.ListPendingDocumentsQuery(repository).execute({limit: 20});

    expect(result.isOk()).toBe(true);
    expect(repository.list).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: expect.objectContaining({status: "PENDING", deletedAt: null, unlinkedAt: null}),
        limit: 20,
        order: ["documentTypeId:asc", "collaboratorId:asc", "_id:asc"]
      })
    );
    if (result.isOk()) {
      expect(result.value.items[0]).toMatchObject({
        status: "PENDING",
        collaborator: {name: "Ana María Silva", cpf: "12345678909"},
        documentType: {name: "Atestado de Saúde Ocupacional", code: "ASO"}
      });
    }
  });

  // QUERY-PENDING-004, QUERY-PENDING-005, QUERY-PENDING-006, QUERY-PENDING-007, QUERY-PENDING-008
  it("normalizes all filters and combines them with AND", async () => {
    const module = await import(queryModulePath);
    const repository = PendingDocumentsRepositoryStub.success();

    const result = await new module.ListPendingDocumentsQuery(repository).execute({
      collaboratorName: "  ÁNA   María  ",
      cpf: "12345678909",
      documentTypeName: "  SAÚDE   ocupacional ",
      documentTypeCode: "ASO",
      limit: 20
    });

    expect(result.isOk()).toBe(true);
    expect(repository.list).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: {
          status: "PENDING",
          deletedAt: null,
          unlinkedAt: null,
          collaboratorName: "ana maria",
          cpf: "12345678909",
          documentTypeName: "saude ocupacional",
          documentTypeCode: "ASO"
        }
      })
    );
  });

  // QUERY-PENDING-009
  it("preserves an empty page without manufacturing pending documents", async () => {
    const module = await import(queryModulePath);
    const repository = PendingDocumentsRepositoryStub.empty();

    const result = await new module.ListPendingDocumentsQuery(repository).execute({limit: 20});

    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value.items).toEqual([]);
    expect(repository.list).toHaveBeenCalledTimes(1);
  });

  // QUERY-PENDING-010, QUERY-PENDING-011, QUERY-PENDING-015, QUERY-PENDING-016,
  // QUERY-PENDING-017, QUERY-PENDING-018
  it.each([
    [{cpf: "123", limit: 20}, "cpf"],
    [{documentTypeCode: "aso", limit: 20}, "documentTypeCode"],
    [{cursor: "", limit: 20}, "cursor"],
    [
      {
        limit: 20,
        after: {
          documentTypeId: "not-an-object-id",
          collaboratorId: "66a64ab05bd7213b90d9b001",
          id: "66a64ab05bd7213b90d9d001"
        }
      },
      "cursor"
    ],
    [{limit: 0}, "limit"],
    [{limit: 101}, "limit"],
    [{limit: 1.5}, "limit"]
  ])("rejects an invalid list input before querying persistence", async (input, field) => {
    const module = await import(queryModulePath);
    const repository = PendingDocumentsRepositoryStub.success();

    const result = await new module.ListPendingDocumentsQuery(repository).execute(input);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("INVALID_QUERY_PARAMETER");
      expect(result.error.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({field})])
      );
    }
    expect(repository.list).not.toHaveBeenCalled();
  });

  // QUERY-PENDING-012, QUERY-PENDING-013, QUERY-PENDING-014
  it("passes the default page, boundary limits, and decoded keyset position to persistence", async () => {
    const module = await import(queryModulePath);
    const repository = PendingDocumentsRepositoryStub.success({
      items: pendingDocumentPageFixtures(2),
      hasNext: true
    });
    const query = new module.ListPendingDocumentsQuery(repository);

    await query.execute({limit: 1});
    await query.execute({limit: 100});
    const result = await query.execute({
      limit: 2,
      after: {
        documentTypeId: "66a64ab05bd7213b90d9e001",
        collaboratorId: "66a64ab05bd7213b90d9b001",
        id: "66a64ab05bd7213b90d9d001"
      }
    });

    expect(result.isOk()).toBe(true);
    expect(repository.list).toHaveBeenNthCalledWith(1, expect.objectContaining({limit: 1}));
    expect(repository.list).toHaveBeenNthCalledWith(2, expect.objectContaining({limit: 100}));
    expect(repository.list).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        after: {
          documentTypeId: "66a64ab05bd7213b90d9e001",
          collaboratorId: "66a64ab05bd7213b90d9b001",
          id: "66a64ab05bd7213b90d9d001"
        }
      })
    );
  });

  // QUERY-PENDING-021, QUERY-PENDING-022
  it.each([
    [PendingDocumentsRepositoryStub.internalError(), "INTERNAL_SERVER_ERROR"],
    [PendingDocumentsRepositoryStub.unavailable(), "SERVICE_UNAVAILABLE"]
  ])("preserves a typed reporting failure", async (repository, code) => {
    const module = await import(queryModulePath);

    const result = await new module.ListPendingDocumentsQuery(repository).execute({limit: 20});

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe(code);
  });
});
