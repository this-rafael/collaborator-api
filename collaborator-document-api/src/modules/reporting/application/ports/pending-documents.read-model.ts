import type {Result} from "neverthrow";

import type {
  PendingDocumentPosition,
  PendingDocumentView
} from "../models/pending-document.view.js";
import type {ReportingFailure} from "../reporting.failure.js";

export type PendingDocumentFilters = Readonly<{
  status: "PENDING";
  deletedAt: null;
  unlinkedAt: null;
  collaboratorName?: string;
  cpf?: string;
  documentTypeName?: string;
  documentTypeCode?: string;
}>;

export type PendingDocumentPage = Readonly<{
  items: readonly PendingDocumentView[];
  hasNext: boolean;
}>;

/** Porta do read model de pendências. */
export interface PendingDocumentsReadModel {
  list(input: {
    filters: PendingDocumentFilters;
    order: readonly ["documentTypeId:asc", "collaboratorId:asc", "_id:asc"];
    limit: number;
    after?: PendingDocumentPosition;
  }): Promise<Result<PendingDocumentPage, ReportingFailure>>;
}
