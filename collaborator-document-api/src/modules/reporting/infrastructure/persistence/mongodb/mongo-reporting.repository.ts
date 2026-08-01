import {Injectable} from "@tsed/di";
import {MongooseService} from "@tsed/mongoose";
import type {Document} from "mongodb";
import {err, ok, type Result} from "neverthrow";

import type {CompletenessCounts} from "../../../application/models/completeness-statistics.view.js";
import type {PendingDocumentView} from "../../../application/models/pending-document.view.js";
import type {CompletenessStatisticsReadModel} from "../../../application/ports/completeness-statistics.read-model.js";
import type {
  PendingDocumentPage,
  PendingDocumentsReadModel
} from "../../../application/ports/pending-documents.read-model.js";
import {reportingFailure, type ReportingFailure} from "../../../application/reporting.failure.js";
import {completenessStatisticsPipeline} from "./pipelines/completeness-statistics.pipeline.js";
import {pendingDocumentsPipeline} from "./pipelines/pending-documents.pipeline.js";

/** Adaptador MongoDB das consultas projetadas de reporting. */
@Injectable()
export class MongoReportingRepository
  implements PendingDocumentsReadModel, CompletenessStatisticsReadModel
{
  constructor(private readonly mongoose: MongooseService) {}

  async list(
    input: Parameters<PendingDocumentsReadModel["list"]>[0]
  ): Promise<Result<PendingDocumentPage, ReportingFailure>> {
    try {
      const database = this.mongoose.get()?.db;
      if (!database) {
        return err(
          reportingFailure("SERVICE_UNAVAILABLE", "Reporting persistence is unavailable.")
        );
      }
      const rows = await database
        .collection("collaborator_documents")
        .aggregate(
          pendingDocumentsPipeline({
            filters: input.filters,
            limit: input.limit,
            ...(input.after ? {after: input.after} : {})
          })
        )
        .toArray();
      const items: PendingDocumentView[] = [];
      for (const row of rows.slice(0, input.limit)) {
        const mapped = pendingDocumentFromRow(row);
        if (mapped.isErr()) return err(mapped.error);
        items.push(mapped.value);
      }
      return ok({items, hasNext: rows.length > input.limit});
    } catch (error) {
      return err(mapMongoFailure(error));
    }
  }

  async getCounts(
    filters: Parameters<CompletenessStatisticsReadModel["getCounts"]>[0]
  ): Promise<Result<CompletenessCounts, ReportingFailure>> {
    try {
      const database = this.mongoose.get()?.db;
      if (!database) {
        return err(
          reportingFailure("SERVICE_UNAVAILABLE", "Reporting persistence is unavailable.")
        );
      }
      const rows = await database
        .collection("collaborator_documents")
        .aggregate(completenessStatisticsPipeline(filters))
        .toArray();
      if (rows.length === 0) {
        return ok({totalActiveDocuments: 0, submittedDocuments: 0});
      }
      return completenessCountsFromRow(rows[0]!);
    } catch (error) {
      return err(mapMongoFailure(error));
    }
  }
}

function completenessCountsFromRow(row: Document): Result<CompletenessCounts, ReportingFailure> {
  const {totalActiveDocuments, submittedDocuments} = row;
  if (
    !Number.isSafeInteger(totalActiveDocuments) ||
    totalActiveDocuments < 0 ||
    !Number.isSafeInteger(submittedDocuments) ||
    submittedDocuments < 0 ||
    submittedDocuments > totalActiveDocuments
  ) {
    return err(reportingFailure("INTERNAL_SERVER_ERROR", "Reporting projection is invalid."));
  }
  return ok({totalActiveDocuments, submittedDocuments});
}

function pendingDocumentFromRow(row: Document): Result<PendingDocumentView, ReportingFailure> {
  const collaborator = asRecord(row.collaborator);
  const documentType = asRecord(row.documentType);
  const linkedAt = toIsoDate(row.linkedAt);
  if (
    typeof row.id !== "string" ||
    row.status !== "PENDING" ||
    !linkedAt ||
    typeof collaborator.id !== "string" ||
    typeof collaborator.name !== "string" ||
    (collaborator.cpf !== undefined && typeof collaborator.cpf !== "string") ||
    typeof documentType.id !== "string" ||
    typeof documentType.name !== "string" ||
    typeof documentType.code !== "string"
  ) {
    return err(reportingFailure("INTERNAL_SERVER_ERROR", "Reporting projection is invalid."));
  }

  return ok({
    id: row.id,
    status: "PENDING",
    linkedAt,
    collaborator: {
      id: collaborator.id,
      name: collaborator.name,
      ...(typeof collaborator.cpf === "string" ? {cpf: collaborator.cpf} : {})
    },
    documentType: {
      id: documentType.id,
      name: documentType.name,
      code: documentType.code
    }
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toIsoDate(value: unknown): string | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value !== "string") return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function mapMongoFailure(error: unknown): ReportingFailure {
  const name = error instanceof Error ? error.name : "";
  if (
    name === "MongoServerSelectionError" ||
    name === "MongoNetworkError" ||
    name === "MongooseServerSelectionError"
  ) {
    return reportingFailure("SERVICE_UNAVAILABLE", "Reporting persistence is unavailable.");
  }
  return reportingFailure("INTERNAL_SERVER_ERROR", "Reporting persistence failed.");
}
