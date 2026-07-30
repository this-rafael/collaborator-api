import {err, ok, type Result} from "neverthrow";

import {
  collaboratorDocumentApplicationFailure,
  type CollaboratorDocumentFailure,
  type FieldError
} from "../../domain/errors/collaborator-document.failure.js";
import type {CollaboratorDocumentOutput} from "../contracts/collaborator-document-output.js";
import type {
  CollaboratorDocumentListFilters,
  CollaboratorDocumentRepository
} from "../ports/collaborator-document-repository.port.js";

const objectIdPattern = /^[a-f\d]{24}$/i;

/** Classifica o lifecycle com precedência deleted > unlinked > active. */
export const classifyLifecycle = (
  document: Pick<CollaboratorDocumentOutput, "deletedAt" | "unlinkedAt">
): "active" | "unlinked" | "deleted" => {
  if (document.deletedAt !== null) return "deleted";
  if (document.unlinkedAt !== null) return "unlinked";
  return "active";
};

/** Normaliza filtros brutos da listagem. */
export const normalizeCollaboratorDocumentFilters = (
  filters: Readonly<{
    collaboratorId?: string;
    documentTypeId?: string;
    status?: string;
    lifecycle?: string;
  }>
): Result<CollaboratorDocumentListFilters, CollaboratorDocumentFailure> => {
  const errors: FieldError[] = [];
  const normalized: {
    collaboratorId?: string;
    documentTypeId?: string;
    status?: "PENDING" | "SUBMITTED";
    lifecycle: "active" | "unlinked" | "deleted" | "all";
  } = {lifecycle: "active"};

  if (filters.collaboratorId !== undefined) {
    if (!objectIdPattern.test(filters.collaboratorId)) {
      errors.push({
        field: "collaboratorId",
        code: "INVALID_OBJECT_ID",
        message: "collaboratorId must be a valid ObjectId"
      });
    } else normalized.collaboratorId = filters.collaboratorId;
  }

  if (filters.documentTypeId !== undefined) {
    if (!objectIdPattern.test(filters.documentTypeId)) {
      errors.push({
        field: "documentTypeId",
        code: "INVALID_OBJECT_ID",
        message: "documentTypeId must be a valid ObjectId"
      });
    } else normalized.documentTypeId = filters.documentTypeId;
  }

  if (filters.status !== undefined) {
    if (filters.status !== "PENDING" && filters.status !== "SUBMITTED") {
      errors.push({
        field: "status",
        code: "INVALID_ENUM",
        message: "status must be PENDING or SUBMITTED"
      });
    } else normalized.status = filters.status;
  }

  if (filters.lifecycle !== undefined) {
    if (
      filters.lifecycle !== "active" &&
      filters.lifecycle !== "unlinked" &&
      filters.lifecycle !== "deleted" &&
      filters.lifecycle !== "all"
    ) {
      errors.push({
        field: "lifecycle",
        code: "INVALID_ENUM",
        message: "lifecycle must be active, unlinked, deleted, or all"
      });
    } else normalized.lifecycle = filters.lifecycle;
  }

  if (errors.length > 0) {
    return err(
      collaboratorDocumentApplicationFailure(
        "INVALID_QUERY_PARAMETER",
        "One or more list filters are invalid.",
        errors
      )
    );
  }

  return ok(Object.freeze(normalized));
};

/** Caso de uso de listagem keyset de vínculos documentais. */
export class ListCollaboratorDocumentsUseCase {
  constructor(private readonly repository: Pick<CollaboratorDocumentRepository, "list">) {}

  async execute(input: {
    filters: Readonly<{
      collaboratorId?: string;
      documentTypeId?: string;
      status?: string;
      lifecycle?: string;
    }>;
    limit: number;
    afterId?: string;
  }): Promise<
    Result<
      Readonly<{items: readonly CollaboratorDocumentOutput[]; hasNext: boolean}>,
      CollaboratorDocumentFailure
    >
  > {
    const filters = normalizeCollaboratorDocumentFilters(input.filters);
    if (filters.isErr()) return err(filters.error);
    return this.repository.list({
      filters: filters.value,
      afterId: input.afterId,
      limit: input.limit
    });
  }
}
