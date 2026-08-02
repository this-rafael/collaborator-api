/**
 * Aggregate root do vínculo entre colaborador e tipo de documento.
 *
 * @remarks
 * Concentra as invariantes de domínio do módulo: ciclo de vida do vínculo
 * (PENDING com `currentVersion=0` ou SUBMITTED), histórico de versões embutidas
 * e regras de reconstituição a partir da persistência. Todas as construções
 * retornam `Result` e nunca lançam falhas de negócio.
 */
import {err, ok, type Result} from "neverthrow";

import {
  collaboratorDocumentDomainFailure,
  type CollaboratorDocumentDomainFailure
} from "../errors/collaborator-document.failure.js";
import {DocumentStatus, type DocumentStatusValue} from "../value-objects/document-status.js";

const objectIdPattern = /^[a-f\d]{24}$/i;

/**
 * Versão documental embutida no histórico do vínculo.
 *
 * @remarks
 * Cada versão é um subdocumento imutável identificado pelo número sequencial em
 * `version`. Aceita campos adicionais para acomodar metadados de envio.
 */
export type DocumentVersionProps = Readonly<{version: number; [key: string]: unknown}>;

/**
 * Estado imutável (snapshot) do agregado de vínculo documental.
 *
 * @remarks
 * Representa a fotografia completa do vínculo, incluindo status, versão atual,
 * histórico de versões e marcos temporais do ciclo de vida (`linkedAt`,
 * `unlinkedAt`, `deletedAt`).
 */
export type CollaboratorDocumentProps = Readonly<{
  id: string;
  collaboratorId: string;
  documentTypeId: string;
  status: DocumentStatusValue;
  currentVersion: number;
  versions: readonly DocumentVersionProps[];
  lastSubmittedAt: Date | null;
  linkedAt: Date;
  unlinkedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}>;

/**
 * Dados brutos, ainda não validados, para iniciar um ciclo PENDING.
 *
 * @remarks
 * Os campos são tipados como `unknown` porque a validação (formato de ObjectId)
 * é responsabilidade do próprio agregado em {@link CollaboratorDocument.createPendingCycle}.
 */
export type CreatePendingCycleProps = Readonly<{
  id: unknown;
  collaboratorId: unknown;
  documentTypeId: unknown;
}>;

/**
 * Aggregate root do vínculo colaborador ↔ tipo de documento.
 *
 * @remarks
 * Instâncias só podem ser obtidas por meio das fábricas estáticas
 * {@link CollaboratorDocument.createPendingCycle} (criação/revinculação) e
 * {@link CollaboratorDocument.reconstitute} (hidratação da persistência). O
 * estado interno é sempre congelado, garantindo imutabilidade.
 */
export class CollaboratorDocument {
  private constructor(private readonly state: CollaboratorDocumentProps) {}

  /** Snapshot imutável (congelado) do estado atual do vínculo. */
  get props(): CollaboratorDocumentProps {
    return freezeProps(this.state);
  }

  /** Identificador (ObjectId em minúsculas) do vínculo. */
  get id(): string {
    return this.state.id;
  }

  /**
   * Inicia um novo ciclo de vínculo no status PENDING com `currentVersion=0`.
   *
   * @param input - Identificadores brutos do vínculo (id, colaborador e tipo de documento) a validar.
   * @param now - Instante corrente usado para `linkedAt`, `createdAt` e `updatedAt`.
   * @returns Result com o agregado criado em sucesso; em falha,
   * CollaboratorDocumentDomainFailure com código VALIDATION_ERROR quando algum
   * identificador não é um ObjectId válido ou `now` não é uma data válida.
   * @remarks
   * A revinculação após o encerramento de um ciclo anterior é modelada como a
   * criação de um NOVO documento lógico, sempre iniciando em PENDING.
   */
  static createPendingCycle(
    input: CreatePendingCycleProps,
    now: Date
  ): Result<CollaboratorDocument, CollaboratorDocumentDomainFailure> {
    const id = normalizedObjectId(input.id);
    if (!id)
      return err(
        collaboratorDocumentDomainFailure("VALIDATION_ERROR", "id must be a valid ObjectId")
      );
    const collaboratorId = normalizedObjectId(input.collaboratorId);
    if (!collaboratorId)
      return err(
        collaboratorDocumentDomainFailure(
          "VALIDATION_ERROR",
          "collaboratorId must be a valid ObjectId"
        )
      );
    const documentTypeId = normalizedObjectId(input.documentTypeId);
    if (!documentTypeId)
      return err(
        collaboratorDocumentDomainFailure(
          "VALIDATION_ERROR",
          "documentTypeId must be a valid ObjectId"
        )
      );
    if (!isValidDate(now)) {
      return err(collaboratorDocumentDomainFailure("VALIDATION_ERROR", "now must be a valid date"));
    }

    const status = DocumentStatus.create("PENDING");
    if (status.isErr()) return err(status.error);

    return ok(
      new CollaboratorDocument(
        freezeProps({
          id,
          collaboratorId,
          documentTypeId,
          status: status.value.value,
          currentVersion: 0,
          versions: [],
          lastSubmittedAt: null,
          linkedAt: now,
          unlinkedAt: null,
          createdAt: now,
          updatedAt: now,
          deletedAt: null
        })
      )
    );
  }

  /**
   * Reconstrói o agregado a partir de um estado previamente persistido.
   *
   * @param props - Estado completo do vínculo carregado da persistência.
   * @returns Result com o agregado reidratado em sucesso; em falha,
   * CollaboratorDocumentDomainFailure com código VALIDATION_ERROR quando o
   * status, o id, as datas, `currentVersion` ou `versions` são inconsistentes.
   * @remarks
   * Diferente de {@link CollaboratorDocument.createPendingCycle}, não aplica
   * regras de criação: apenas revalida invariantes estruturais do estado.
   */
  static reconstitute(
    props: CollaboratorDocumentProps
  ): Result<CollaboratorDocument, CollaboratorDocumentDomainFailure> {
    const status = DocumentStatus.create(props.status);
    if (status.isErr()) return err(status.error);
    if (!normalizedObjectId(props.id)) {
      return err(
        collaboratorDocumentDomainFailure("VALIDATION_ERROR", "id must be a valid ObjectId")
      );
    }
    if (!normalizedObjectId(props.collaboratorId)) {
      return err(
        collaboratorDocumentDomainFailure(
          "VALIDATION_ERROR",
          "collaboratorId must be a valid ObjectId"
        )
      );
    }
    if (!normalizedObjectId(props.documentTypeId)) {
      return err(
        collaboratorDocumentDomainFailure(
          "VALIDATION_ERROR",
          "documentTypeId must be a valid ObjectId"
        )
      );
    }
    if (
      !isValidDate(props.createdAt) ||
      !isValidDate(props.updatedAt) ||
      !isValidDate(props.linkedAt)
    ) {
      return err(
        collaboratorDocumentDomainFailure("VALIDATION_ERROR", "persistence dates must be valid")
      );
    }
    if (props.deletedAt !== null && !isValidDate(props.deletedAt)) {
      return err(
        collaboratorDocumentDomainFailure("VALIDATION_ERROR", "deletedAt must be a valid date")
      );
    }
    if (props.unlinkedAt !== null && !isValidDate(props.unlinkedAt)) {
      return err(
        collaboratorDocumentDomainFailure("VALIDATION_ERROR", "unlinkedAt must be a valid date")
      );
    }
    if (props.lastSubmittedAt !== null && !isValidDate(props.lastSubmittedAt)) {
      return err(
        collaboratorDocumentDomainFailure(
          "VALIDATION_ERROR",
          "lastSubmittedAt must be a valid date"
        )
      );
    }
    if (!Number.isInteger(props.currentVersion) || props.currentVersion < 0) {
      return err(
        collaboratorDocumentDomainFailure(
          "VALIDATION_ERROR",
          "currentVersion must be a non-negative integer"
        )
      );
    }
    if (!Array.isArray(props.versions)) {
      return err(
        collaboratorDocumentDomainFailure("VALIDATION_ERROR", "versions must be an array")
      );
    }
    const lifecycle = validateLifecycle(props, status.value.value);
    if (lifecycle.isErr()) return err(lifecycle.error);

    return ok(new CollaboratorDocument(freezeProps({...props, status: status.value.value})));
  }
}

function normalizedObjectId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return objectIdPattern.test(trimmed) ? trimmed.toLowerCase() : null;
}

function isValidDate(value: Date): boolean {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

function validateLifecycle(
  props: CollaboratorDocumentProps,
  status: DocumentStatusValue
): Result<void, CollaboratorDocumentDomainFailure> {
  if (status === "PENDING") {
    if (
      props.currentVersion !== 0 ||
      props.versions.length !== 0 ||
      props.lastSubmittedAt !== null
    ) {
      return err(
        collaboratorDocumentDomainFailure(
          "VALIDATION_ERROR",
          "PENDING documents must have version 0, empty history, and no last submission"
        )
      );
    }
    return ok(undefined);
  }

  if (props.currentVersion < 1 || props.lastSubmittedAt === null) {
    return err(
      collaboratorDocumentDomainFailure(
        "VALIDATION_ERROR",
        "SUBMITTED documents must have a current version and last submission"
      )
    );
  }
  if (props.versions.length !== props.currentVersion) {
    return err(
      collaboratorDocumentDomainFailure(
        "VALIDATION_ERROR",
        "submitted history must contain every version up to currentVersion"
      )
    );
  }

  for (const [index, version] of props.versions.entries()) {
    if (!isValidDocumentVersion(version) || version.version !== index + 1) {
      return err(
        collaboratorDocumentDomainFailure(
          "VALIDATION_ERROR",
          "submitted history versions must be positive, contiguous, and ordered"
        )
      );
    }
  }
  return ok(undefined);
}

function isValidDocumentVersion(value: unknown): value is DocumentVersionProps {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const version = (value as {version?: unknown}).version;
  return typeof version === "number" && Number.isSafeInteger(version) && version >= 1;
}

function freezeProps(value: CollaboratorDocumentProps): CollaboratorDocumentProps {
  return Object.freeze({
    ...value,
    versions: Object.freeze([...value.versions.map((version) => Object.freeze({...version}))]),
    lastSubmittedAt: value.lastSubmittedAt ? new Date(value.lastSubmittedAt) : null,
    linkedAt: new Date(value.linkedAt),
    unlinkedAt: value.unlinkedAt ? new Date(value.unlinkedAt) : null,
    createdAt: new Date(value.createdAt),
    updatedAt: new Date(value.updatedAt),
    deletedAt: value.deletedAt ? new Date(value.deletedAt) : null
  });
}
