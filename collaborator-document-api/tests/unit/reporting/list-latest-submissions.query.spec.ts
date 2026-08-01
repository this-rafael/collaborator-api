import {describe, expect, it} from "vitest";

import {latestSubmissionPageFixtures} from "../../helpers/reporting-fixtures.js";
import {LatestSubmissionsRepositoryStub} from "../../helpers/reporting-runtime.js";

const queryModulePath =
  "../../../src/modules/reporting/application/queries/list-latest-submissions.query.js";

describe("Listing latest submissions through the query", () => {
  // SUB-LATEST-001, SUB-LATEST-002, SUB-LATEST-003, SUB-LATEST-004, SUB-LATEST-005
  it("requests one active submitted snapshot per link in deterministic latest-first order", async () => {
    const module = await import(queryModulePath);
    const repository = LatestSubmissionsRepositoryStub.success();

    const result = await new module.ListLatestSubmissionsQuery(repository).execute({limit: 20});

    expect(result.isOk()).toBe(true);
    expect(repository.listLatestSubmissions).toHaveBeenCalledWith({
      filters: {status: "SUBMITTED", deletedAt: null, unlinkedAt: null},
      order: ["lastSubmittedAt:desc", "_id:desc"],
      limit: 20
    });
    if (result.isOk()) {
      expect(result.value.items[0]).toMatchObject({
        documentId: "66a64ab05bd7213b90d9c001",
        currentVersion: 2,
        lastSubmittedAt: "2026-07-31T15:00:00.000Z",
        collaborator: {name: "Ana María Silva", cpf: "12345678909"},
        documentType: {name: "Atestado de Saúde Ocupacional", code: "ASO"}
      });
    }
  });

  // SUB-LATEST-006
  it("preserves an empty page without manufacturing submission snapshots", async () => {
    const module = await import(queryModulePath);
    const repository = LatestSubmissionsRepositoryStub.empty();

    const result = await new module.ListLatestSubmissionsQuery(repository).execute({limit: 20});

    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value.items).toEqual([]);
    expect(repository.listLatestSubmissions).toHaveBeenCalledTimes(1);
  });

  // SUB-LATEST-007, SUB-LATEST-008, SUB-LATEST-009
  it("passes default, boundary limits, and the composite keyset position to persistence", async () => {
    const module = await import(queryModulePath);
    const repository = LatestSubmissionsRepositoryStub.success({
      items: latestSubmissionPageFixtures(2),
      hasNext: true
    });
    const query = new module.ListLatestSubmissionsQuery(repository);

    await query.execute({});
    await query.execute({limit: 1});
    await query.execute({limit: 100});
    const result = await query.execute({
      limit: 2,
      after: {
        lastSubmittedAt: "2026-07-31T14:59:00.000Z",
        id: "66a64ab05bd7213b90d9d002"
      }
    });

    expect(result.isOk()).toBe(true);
    expect(repository.listLatestSubmissions).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({limit: 20})
    );
    expect(repository.listLatestSubmissions).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({limit: 1})
    );
    expect(repository.listLatestSubmissions).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({limit: 100})
    );
    expect(repository.listLatestSubmissions).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({
        after: {
          lastSubmittedAt: "2026-07-31T14:59:00.000Z",
          id: "66a64ab05bd7213b90d9d002"
        }
      })
    );
  });

  // SUB-LATEST-010, SUB-LATEST-011, SUB-LATEST-012, SUB-LATEST-013, SUB-LATEST-018
  it.each([
    [{cursor: "", limit: 20}, "cursor"],
    [{limit: 0}, "limit"],
    [{limit: 101}, "limit"],
    [{limit: 1.5}, "limit"],
    [
      {
        limit: 20,
        after: {lastSubmittedAt: "not-a-date", id: "invalid"}
      },
      "cursor"
    ]
  ])(
    "rejects an invalid latest-submissions input before querying persistence",
    async (input, field) => {
      const module = await import(queryModulePath);
      const repository = LatestSubmissionsRepositoryStub.success();

      const result = await new module.ListLatestSubmissionsQuery(repository).execute(input);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("INVALID_QUERY_PARAMETER");
        expect(result.error.errors).toEqual(
          expect.arrayContaining([expect.objectContaining({field})])
        );
      }
      expect(repository.listLatestSubmissions).not.toHaveBeenCalled();
    }
  );

  // SUB-LATEST-016, SUB-LATEST-017
  it.each([
    [LatestSubmissionsRepositoryStub.internalError(), "INTERNAL_SERVER_ERROR"],
    [LatestSubmissionsRepositoryStub.unavailable(), "SERVICE_UNAVAILABLE"]
  ])("preserves a typed reporting failure", async (repository, code) => {
    const module = await import(queryModulePath);

    const result = await new module.ListLatestSubmissionsQuery(repository).execute({limit: 20});

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe(code);
  });
});
