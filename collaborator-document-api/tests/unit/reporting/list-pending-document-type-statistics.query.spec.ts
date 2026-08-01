import {describe, expect, it} from "vitest";

import {pendingDocumentTypeStatisticFixtures} from "../../helpers/reporting-fixtures.js";
import {PendingDocumentTypeStatisticsRepositoryStub} from "../../helpers/reporting-runtime.js";

const queryModulePath =
  "../../../src/modules/reporting/application/queries/list-pending-document-type-statistics.query.js";

describe("Listing pending document type statistics through the query", () => {
  // STAT-TYPE-001, STAT-TYPE-002, STAT-TYPE-003, STAT-TYPE-004, STAT-TYPE-005
  it("requests active pending counts in deterministic ranking order", async () => {
    const module = await import(queryModulePath);
    const repository = PendingDocumentTypeStatisticsRepositoryStub.success();

    const result = await new module.ListPendingDocumentTypeStatisticsQuery(repository).execute({
      limit: 20
    });

    expect(result.isOk()).toBe(true);
    expect(repository.listPendingDocumentTypeStatistics).toHaveBeenCalledWith({
      filters: {status: "PENDING", deletedAt: null, unlinkedAt: null},
      order: ["pendingCount:desc", "documentTypeId:asc"],
      limit: 20
    });
    if (result.isOk()) {
      expect(result.value.items[0]).toMatchObject({
        documentType: {
          id: "66a64ab05bd7213b90d9b010",
          name: "Atestado de Saúde Ocupacional",
          code: "ASO"
        },
        pendingCount: 3
      });
    }
  });

  // STAT-TYPE-006
  it("preserves an empty ranking without manufacturing document types", async () => {
    const module = await import(queryModulePath);
    const repository = PendingDocumentTypeStatisticsRepositoryStub.empty();

    const result = await new module.ListPendingDocumentTypeStatisticsQuery(repository).execute({
      limit: 20
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value.items).toEqual([]);
    expect(repository.listPendingDocumentTypeStatistics).toHaveBeenCalledTimes(1);
  });

  // STAT-TYPE-007, STAT-TYPE-008, STAT-TYPE-009
  it("passes default, boundary limits, and the composite keyset position to persistence", async () => {
    const module = await import(queryModulePath);
    const repository = PendingDocumentTypeStatisticsRepositoryStub.success({
      items: pendingDocumentTypeStatisticFixtures(2),
      hasNext: true
    });
    const query = new module.ListPendingDocumentTypeStatisticsQuery(repository);

    await query.execute({});
    await query.execute({limit: 1});
    await query.execute({limit: 100});
    const result = await query.execute({
      limit: 2,
      after: {pendingCount: 2, documentTypeId: "66a64ab05bd7213b90d9e002"}
    });

    expect(result.isOk()).toBe(true);
    expect(repository.listPendingDocumentTypeStatistics).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({limit: 20})
    );
    expect(repository.listPendingDocumentTypeStatistics).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({limit: 1})
    );
    expect(repository.listPendingDocumentTypeStatistics).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({limit: 100})
    );
    expect(repository.listPendingDocumentTypeStatistics).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({
        after: {pendingCount: 2, documentTypeId: "66a64ab05bd7213b90d9e002"}
      })
    );
  });

  // STAT-TYPE-010, STAT-TYPE-011, STAT-TYPE-012, STAT-TYPE-013, STAT-TYPE-018
  it.each([
    [{cursor: "", limit: 20}, "cursor"],
    [{limit: 0}, "limit"],
    [{limit: 101}, "limit"],
    [{limit: 1.5}, "limit"],
    [{limit: 20, after: {pendingCount: 0, documentTypeId: "invalid"}}, "cursor"]
  ])("rejects an invalid ranking input before querying persistence", async (input, field) => {
    const module = await import(queryModulePath);
    const repository = PendingDocumentTypeStatisticsRepositoryStub.success();

    const result = await new module.ListPendingDocumentTypeStatisticsQuery(repository).execute(
      input
    );

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("INVALID_QUERY_PARAMETER");
      expect(result.error.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({field})])
      );
    }
    expect(repository.listPendingDocumentTypeStatistics).not.toHaveBeenCalled();
  });

  // STAT-TYPE-016, STAT-TYPE-017
  it.each([
    [PendingDocumentTypeStatisticsRepositoryStub.internalError(), "INTERNAL_SERVER_ERROR"],
    [PendingDocumentTypeStatisticsRepositoryStub.unavailable(), "SERVICE_UNAVAILABLE"]
  ])("preserves a typed ranking failure", async (repository, code) => {
    const module = await import(queryModulePath);

    const result = await new module.ListPendingDocumentTypeStatisticsQuery(repository).execute({
      limit: 20
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe(code);
  });
});
