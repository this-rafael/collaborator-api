import {describe, expect, it} from "vitest";

import {FixedClock} from "../../helpers/clock.js";
import {completenessCountsFixture} from "../../helpers/reporting-fixtures.js";
import {CompletenessStatisticsRepositoryStub} from "../../helpers/reporting-runtime.js";

const queryModulePath =
  "../../../src/modules/reporting/application/queries/get-completeness-statistics.query.js";
const calculatedAt = new Date("2026-07-31T12:00:00.000Z");

describe("GetCompletenessStatisticsQuery", () => {
  // STAT-COMP-001
  it("returns zero counts and percentage when there are no active links", async () => {
    const module = await import(queryModulePath);
    const repository = CompletenessStatisticsRepositoryStub.success(
      completenessCountsFixture({totalActiveDocuments: 0, submittedDocuments: 0})
    );

    const result = await new module.GetCompletenessStatisticsQuery(
      repository,
      new FixedClock(calculatedAt)
    ).execute();

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toEqual({
        totalActiveDocuments: 0,
        submittedDocuments: 0,
        pendingDocuments: 0,
        percentage: 0,
        calculatedAt: calculatedAt.toISOString()
      });
    }
  });

  // STAT-COMP-002
  it("returns zero percent when every active link is pending", async () => {
    const module = await import(queryModulePath);
    const repository = CompletenessStatisticsRepositoryStub.success(
      completenessCountsFixture({totalActiveDocuments: 3, submittedDocuments: 0})
    );

    const result = await new module.GetCompletenessStatisticsQuery(
      repository,
      new FixedClock(calculatedAt)
    ).execute();

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toMatchObject({
        totalActiveDocuments: 3,
        submittedDocuments: 0,
        pendingDocuments: 3,
        percentage: 0
      });
    }
  });

  // STAT-COMP-003
  it("returns one hundred percent when every active link is submitted", async () => {
    const module = await import(queryModulePath);
    const repository = CompletenessStatisticsRepositoryStub.success(
      completenessCountsFixture({totalActiveDocuments: 3, submittedDocuments: 3})
    );

    const result = await new module.GetCompletenessStatisticsQuery(
      repository,
      new FixedClock(calculatedAt)
    ).execute();

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toMatchObject({
        totalActiveDocuments: 3,
        submittedDocuments: 3,
        pendingDocuments: 0,
        percentage: 100
      });
    }
  });

  // STAT-COMP-004
  it.each([
    [1, 3, 33.33],
    [2, 3, 66.67],
    [1, 6, 16.67],
    [1, 32, 3.13]
  ])(
    "rounds %i submitted links among %i active links HALF_UP to two decimal places",
    async (submittedDocuments, totalActiveDocuments, percentage) => {
      const module = await import(queryModulePath);
      const repository = CompletenessStatisticsRepositoryStub.success(
        completenessCountsFixture({totalActiveDocuments, submittedDocuments})
      );

      const result = await new module.GetCompletenessStatisticsQuery(
        repository,
        new FixedClock(calculatedAt)
      ).execute();

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toMatchObject({
          totalActiveDocuments,
          submittedDocuments,
          pendingDocuments: totalActiveDocuments - submittedDocuments,
          percentage
        });
        expect(typeof result.value.percentage).toBe("number");
      }
    }
  );

  // STAT-COMP-005, STAT-COMP-006
  it("counts only current document links without using collaborator rows as the denominator", async () => {
    const module = await import(queryModulePath);
    const repository = CompletenessStatisticsRepositoryStub.success(
      completenessCountsFixture({totalActiveDocuments: 2, submittedDocuments: 1})
    );

    const result = await new module.GetCompletenessStatisticsQuery(
      repository,
      new FixedClock(calculatedAt)
    ).execute();

    expect(result.isOk()).toBe(true);
    expect(repository.getCounts).toHaveBeenCalledWith({deletedAt: null, unlinkedAt: null});
    if (result.isOk()) {
      expect(result.value).toMatchObject({
        totalActiveDocuments: 2,
        submittedDocuments: 1,
        pendingDocuments: 1,
        percentage: 50
      });
    }
  });

  // STAT-COMP-010, STAT-COMP-011
  it.each([
    [CompletenessStatisticsRepositoryStub.internalError(), "INTERNAL_SERVER_ERROR"],
    [CompletenessStatisticsRepositoryStub.unavailable(), "SERVICE_UNAVAILABLE"]
  ])("preserves a typed completeness failure", async (repository, code) => {
    const module = await import(queryModulePath);

    const result = await new module.GetCompletenessStatisticsQuery(
      repository,
      new FixedClock(calculatedAt)
    ).execute();

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe(code);
  });
});
