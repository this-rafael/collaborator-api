import type {CollaboratorDocument} from "../../domain/aggregates/collaborator-document.js";
import type {DocumentStatusValue} from "../../domain/value-objects/document-status.js";

/** Representação primitiva do vínculo na fronteira da aplicação. */
export type CollaboratorDocumentOutput = Readonly<{
  id: string;
  collaboratorId: string;
  documentTypeId: string;
  status: DocumentStatusValue;
  currentVersion: number;
  versions: readonly unknown[];
  lastSubmittedAt: string | null;
  linkedAt: string;
  unlinkedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  versionCount: number;
}>;

/** Converte o agregado para saída primitiva. */
export const collaboratorDocumentToOutput = (
  document: CollaboratorDocument
): CollaboratorDocumentOutput => {
  const props = document.props;
  return Object.freeze({
    id: props.id,
    collaboratorId: props.collaboratorId,
    documentTypeId: props.documentTypeId,
    status: props.status,
    currentVersion: props.currentVersion,
    versions: props.versions,
    lastSubmittedAt: props.lastSubmittedAt?.toISOString() ?? null,
    linkedAt: props.linkedAt.toISOString(),
    unlinkedAt: props.unlinkedAt?.toISOString() ?? null,
    createdAt: props.createdAt.toISOString(),
    updatedAt: props.updatedAt.toISOString(),
    deletedAt: props.deletedAt?.toISOString() ?? null,
    versionCount: props.versions.length
  });
};
