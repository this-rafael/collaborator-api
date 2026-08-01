import {Injectable} from "@tsed/di";
import {MongooseService} from "@tsed/mongoose";
import type {IndexDescription} from "mongodb";
import {err, ok, type Result} from "neverthrow";

import {reportingFailure, type ReportingFailure} from "../../../application/reporting.failure.js";

export const pendingDocumentIndexes: readonly IndexDescription[] = [
  {
    key: {
      status: 1,
      deletedAt: 1,
      unlinkedAt: 1,
      documentTypeId: 1,
      collaboratorId: 1,
      _id: 1
    },
    name: "collaborator_documents_pending_reporting_keyset",
    partialFilterExpression: {status: "PENDING", deletedAt: null, unlinkedAt: null}
  },
  {
    key: {status: 1, deletedAt: 1, unlinkedAt: 1, lastSubmittedAt: -1, _id: -1},
    name: "collaborator_documents_latest_submissions_keyset",
    partialFilterExpression: {
      status: "SUBMITTED",
      deletedAt: null,
      unlinkedAt: null,
      lastSubmittedAt: {$type: "date"}
    }
  }
];

/** Garante os índices que sustentam os filtros e ordenações de reporting. */
@Injectable()
export class PendingDocumentsIndexProvisioner {
  constructor(private readonly mongoose: MongooseService) {}

  async ensure(): Promise<Result<readonly string[], ReportingFailure>> {
    try {
      const database = this.mongoose.get()?.db;
      if (!database) {
        return err(
          reportingFailure("SERVICE_UNAVAILABLE", "Reporting persistence is unavailable.")
        );
      }
      const names = await database
        .collection("collaborator_documents")
        .createIndexes([...pendingDocumentIndexes]);
      return ok(names);
    } catch {
      return err(
        reportingFailure("INTERNAL_SERVER_ERROR", "Reporting indexes could not be created.")
      );
    }
  }
}
