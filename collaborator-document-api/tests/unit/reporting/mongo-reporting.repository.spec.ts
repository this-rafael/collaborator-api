import type {MongooseService} from "@tsed/mongoose";
import type {Document} from "mongodb";
import type {Result} from "neverthrow";
import {describe, expect, it, vi} from "vitest";

import {MongoReportingRepository} from "../../../src/modules/reporting/infrastructure/persistence/mongodb/mongo-reporting.repository.js";

const pendingInput = {
  filters: {status: "PENDING", deletedAt: null, unlinkedAt: null},
  order: ["documentTypeId:asc", "collaboratorId:asc", "_id:asc"],
  limit: 20
} as const;

const latestInput = {
  filters: {status: "SUBMITTED", deletedAt: null, unlinkedAt: null},
  order: ["lastSubmittedAt:desc", "_id:desc"],
  limit: 20
} as const;

const eventInput = {
  filters: {deletedAt: null, unlinkedAt: null, hasVersions: true},
  order: ["submittedAt:desc", "documentId:desc", "version:desc"],
  limit: 20
} as const;

const statisticInput = {
  filters: {status: "PENDING", deletedAt: null, unlinkedAt: null},
  order: ["pendingCount:desc", "documentTypeId:asc"],
  limit: 20
} as const;

const documentType = {
  id: "66a64ab05bd7213b90d9b010",
  name: "Atestado de Saúde Ocupacional",
  code: "ASO"
};

const collaborator = {
  id: "66a64ab05bd7213b90d9b001",
  name: "Ana María Silva",
  cpf: "12345678909"
};

function repositoryReturning(rows: Document[]): MongoReportingRepository {
  const mongoose = {
    get: () => ({
      db: {
        collection: () => ({
          aggregate: () => ({toArray: async () => rows})
        })
      }
    })
  } as unknown as MongooseService;

  return new MongoReportingRepository(mongoose);
}

function repositoryRejecting(error: unknown): MongoReportingRepository {
  const mongoose = {
    get: () => ({
      db: {
        collection: () => ({
          aggregate: () => ({
            toArray: vi.fn().mockRejectedValue(error)
          })
        })
      }
    })
  } as unknown as MongooseService;

  return new MongoReportingRepository(mongoose);
}

function expectFailureCode(
  result: Result<unknown, {code: string; message: string}>,
  code: string,
  message?: string
): void {
  expect(result.isErr()).toBe(true);
  if (result.isErr()) {
    expect(result.error.code).toBe(code);
    if (message) expect(result.error.message).toBe(message);
  }
}

describe("MongoReportingRepository", () => {
  it("rejects malformed rows from every paginated projection", async () => {
    const pending = await repositoryReturning([
      {
        id: "66a64ab05bd7213b90d9c001",
        status: "PENDING",
        linkedAt: new Date("2026-07-30T12:00:00.000Z"),
        collaborator,
        documentType: {...documentType, code: 42}
      }
    ]).list(pendingInput);
    const latest = await repositoryReturning([
      {
        documentId: "66a64ab05bd7213b90d9c001",
        currentVersion: 2,
        lastSubmittedAt: "2026-07-31T15:00:00.000Z",
        collaborator,
        documentType: {...documentType, code: 42}
      }
    ]).listLatestSubmissions(latestInput);
    const event = await repositoryReturning([
      {
        documentId: "66a64ab05bd7213b90d9c001",
        version: 2,
        submittedAt: "2026-07-31T15:00:00.000Z",
        metadata: {
          originalName: "document-v2.pdf",
          mimeType: "application/pdf",
          sizeBytes: 2048,
          storageKey: "documents/document-v2.pdf",
          notes: undefined
        }
      }
    ]).listSubmissionEvents(eventInput);
    const statistic = await repositoryReturning([
      {pendingCount: 3, documentType: {...documentType, code: 42}}
    ]).listPendingDocumentTypeStatistics(statisticInput);

    for (const result of [pending, latest, event, statistic]) {
      expectFailureCode(result, "INTERNAL_SERVER_ERROR", "Reporting projection is invalid.");
    }
  });

  it("rejects inconsistent completeness counts", async () => {
    const result = await repositoryReturning([
      {totalActiveDocuments: 2, submittedDocuments: 3}
    ]).getCounts({deletedAt: null, unlinkedAt: null});

    expectFailureCode(result, "INTERNAL_SERVER_ERROR", "Reporting projection is invalid.");
  });

  it("maps valid projections without an optional CPF", async () => {
    const collaboratorWithoutCpf = {
      id: collaborator.id,
      name: collaborator.name
    };
    const pending = await repositoryReturning([
      {
        id: "66a64ab05bd7213b90d9c001",
        status: "PENDING",
        linkedAt: new Date("2026-07-30T12:00:00.000Z"),
        collaborator: collaboratorWithoutCpf,
        documentType
      }
    ]).list(pendingInput);
    const latest = await repositoryReturning([
      {
        documentId: "66a64ab05bd7213b90d9c001",
        currentVersion: 2,
        lastSubmittedAt: new Date("2026-07-31T15:00:00.000Z"),
        collaborator: collaboratorWithoutCpf,
        documentType
      }
    ]).listLatestSubmissions(latestInput);

    expect(pending.isOk()).toBe(true);
    expect(latest.isOk()).toBe(true);
    if (pending.isOk())
      expect(pending.value.items[0]?.collaborator).toEqual(collaboratorWithoutCpf);
    if (latest.isOk()) expect(latest.value.items[0]?.collaborator).toEqual(collaboratorWithoutCpf);
  });

  it("rejects non-record nested values and invalid date strings", async () => {
    const invalidNestedValue = await repositoryReturning([
      {
        id: "66a64ab05bd7213b90d9c001",
        status: "PENDING",
        linkedAt: "2026-07-30T12:00:00.000Z",
        collaborator: null,
        documentType
      }
    ]).list(pendingInput);
    const invalidDate = await repositoryReturning([
      {
        documentId: "66a64ab05bd7213b90d9c001",
        currentVersion: 2,
        lastSubmittedAt: "not-a-date",
        collaborator,
        documentType
      }
    ]).listLatestSubmissions(latestInput);

    for (const result of [invalidNestedValue, invalidDate]) {
      expectFailureCode(result, "INTERNAL_SERVER_ERROR", "Reporting projection is invalid.");
    }
  });

  it("maps network and non-error aggregate rejections", async () => {
    const unavailable = new Error("connection unavailable");
    unavailable.name = "MongooseServerSelectionError";

    const networkResult = await repositoryRejecting(unavailable).list(pendingInput);
    const unknownResult = await repositoryRejecting("aggregate failed").list(pendingInput);

    expectFailureCode(networkResult, "SERVICE_UNAVAILABLE");
    expectFailureCode(unknownResult, "INTERNAL_SERVER_ERROR");
  });
});
