import {describe, expect, it} from "vitest";

import {submissionEventPageFixtures} from "../../helpers/reporting-fixtures.js";
import {SubmissionEventsRepositoryStub} from "../../helpers/reporting-runtime.js";

const queryModulePath =
  "../../../src/modules/reporting/application/queries/list-submission-events.query.js";

describe("Listing submission events through the query", () => {
  // SUB-EVENT-001, SUB-EVENT-002, SUB-EVENT-003, SUB-EVENT-004, SUB-EVENT-005
  it("requests every version from active histories in deterministic latest-first order", async () => {
    const module = await import(queryModulePath);
    const repository = SubmissionEventsRepositoryStub.success();

    const result = await new module.ListSubmissionEventsQuery(repository).execute({limit: 20});

    expect(result.isOk()).toBe(true);
    expect(repository.listSubmissionEvents).toHaveBeenCalledWith({
      filters: {deletedAt: null, unlinkedAt: null, hasVersions: true},
      order: ["submittedAt:desc", "documentId:desc", "version:desc"],
      limit: 20
    });
    if (result.isOk()) {
      expect(result.value.items[0]).toMatchObject({
        documentId: "66a64ab05bd7213b90d9c001",
        version: 2,
        submittedAt: "2026-07-31T15:00:00.000Z",
        metadata: {
          originalName: "document-v2.pdf",
          mimeType: "application/pdf",
          sizeBytes: 2048,
          storageKey: "documents/66a64ab05bd7213b90d9c001/v2",
          notes: "Second submission"
        }
      });
    }
  });

  // SUB-EVENT-006
  it("preserves an empty page without manufacturing historical events", async () => {
    const module = await import(queryModulePath);
    const repository = SubmissionEventsRepositoryStub.empty();

    const result = await new module.ListSubmissionEventsQuery(repository).execute({limit: 20});

    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value.items).toEqual([]);
    expect(repository.listSubmissionEvents).toHaveBeenCalledTimes(1);
  });

  // SUB-EVENT-007, SUB-EVENT-008, SUB-EVENT-009
  it("passes default, boundary limits, and the composite event position to persistence", async () => {
    const module = await import(queryModulePath);
    const repository = SubmissionEventsRepositoryStub.success({
      items: submissionEventPageFixtures(2),
      hasNext: true
    });
    const query = new module.ListSubmissionEventsQuery(repository);

    await query.execute({});
    await query.execute({limit: 1});
    await query.execute({limit: 100});
    const result = await query.execute({
      limit: 2,
      after: {
        submittedAt: "2026-07-31T14:59:00.000Z",
        documentId: "66a64ab05bd7213b90d9d002",
        version: 2
      }
    });

    expect(result.isOk()).toBe(true);
    expect(repository.listSubmissionEvents).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({limit: 20})
    );
    expect(repository.listSubmissionEvents).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({limit: 1})
    );
    expect(repository.listSubmissionEvents).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({limit: 100})
    );
    expect(repository.listSubmissionEvents).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({
        after: {
          submittedAt: "2026-07-31T14:59:00.000Z",
          documentId: "66a64ab05bd7213b90d9d002",
          version: 2
        }
      })
    );
  });

  // SUB-EVENT-010, SUB-EVENT-011, SUB-EVENT-012, SUB-EVENT-013, SUB-EVENT-018
  it.each([
    [{cursor: "", limit: 20}, "cursor"],
    [{limit: 0}, "limit"],
    [{limit: 101}, "limit"],
    [{limit: 1.5}, "limit"],
    [
      {
        limit: 20,
        after: {submittedAt: "not-a-date", documentId: "invalid", version: 0}
      },
      "cursor"
    ]
  ])("rejects an invalid event-list input before querying persistence", async (input, field) => {
    const module = await import(queryModulePath);
    const repository = SubmissionEventsRepositoryStub.success();

    const result = await new module.ListSubmissionEventsQuery(repository).execute(input);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("INVALID_QUERY_PARAMETER");
      expect(result.error.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({field})])
      );
    }
    expect(repository.listSubmissionEvents).not.toHaveBeenCalled();
  });

  // SUB-EVENT-016, SUB-EVENT-017
  it.each([
    [SubmissionEventsRepositoryStub.internalError(), "INTERNAL_SERVER_ERROR"],
    [SubmissionEventsRepositoryStub.unavailable(), "SERVICE_UNAVAILABLE"]
  ])("preserves a typed reporting failure", async (repository, code) => {
    const module = await import(queryModulePath);

    const result = await new module.ListSubmissionEventsQuery(repository).execute({limit: 20});

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe(code);
  });
});
