/**
 * Caso de uso de listagem por keyset e utilitários de normalização de filtros.
 */
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

/**
 * Classifica o estágio do ciclo de vida de um vínculo.
 *
 * @param document - Vínculo do qual se avaliam `deletedAt` e `unlinkedAt`.
 * @returns "deleted" se excluído, "unlinked" se desvinculado, senão "active".
 * @remarks
 * A precedência é deleted &gt; unlinked &gt; active: um vínculo excluído é sempre
 * classificado como "deleted", mesmo que também esteja desvinculado.
 */
export const classifyLifecycle = (
  document: Pick<CollaboratorDocumentOutput, "deletedAt" | "unlinkedAt">
): "active" | "unlinked" | "deleted" => {
  if (document.deletedAt !== null) return "deleted";
  if (document.unlinkedAt !== null) return "unlinked";
  return "active";
};

/**
 * Normaliza e valida os filtros brutos recebidos na listagem.
 *
 * @param filters - Filtros brutos (ainda como strings) vindos da consulta HTTP.
 * @returns Result com os filtros normalizados em sucesso; em falha,
 * CollaboratorDocumentFailure com código INVALID_QUERY_PARAMETER acompanhado dos
 * erros por campo (collaboratorId, documentTypeId, status ou lifecycle).
 * @remarks
 * Quando `lifecycle` é omitido, assume-se "active" por padrão.
 */
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
  /**
   * @param repository - Porta de persistência (apenas a operação `list`).
   */
  constructor(private readonly repository: Pick<CollaboratorDocumentRepository, "list">) {}

  /**
   * Lista vínculos documentais aplicando filtros normalizados e paginação keyset.
   *
   * @param input - Filtros brutos, `limit` da página e cursor `afterId` opcional.
   * @returns Result com os itens e o indicador `hasNext` em sucesso; em falha,
   * CollaboratorDocumentFailure com códigos INVALID_QUERY_PARAMETER,
   * SERVICE_UNAVAILABLE ou INTERNAL_SERVER_ERROR.
   */
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
