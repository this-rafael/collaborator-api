import {err, ok, type Result} from "neverthrow";

import {
  collaboratorDocumentDomainFailure,
  type CollaboratorDocumentDomainFailure
} from "../errors/collaborator-document.failure.js";
import {DocumentStatus, type DocumentStatusValue} from "../value-objects/document-status.js";

const objectIdPattern = /^[a-f\d]{24}$/i;

/** Versão documental embutida (histórico). */
export type DocumentVersionProps = Readonly<{version: number; [key: string]: unknown}>;

/** Estado imutável do agregado de vínculo documental. */
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

/** Dados brutos para iniciar um ciclo PENDING. */
export type CreatePendingCycleProps = Readonly<{
  id: unknown;
  collaboratorId: unknown;
  documentTypeId: unknown;
}>;

/** Aggregate root de vínculo colaborador ↔ tipo de documento. */
export class CollaboratorDocument {
  private constructor(private readonly state: CollaboratorDocumentProps) {}

  get props(): CollaboratorDocumentProps {
    return freezeProps(this.state);
  }

  get id(): string {
    return this.state.id;
  }

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
