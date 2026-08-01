/**
 * Contrato de saída (DTO) do vínculo documental na fronteira da aplicação.
 *
 * @remarks
 * Converte o agregado de domínio em uma representação primitiva e serializável
 * (datas em ISO 8601), consumida pelas camadas de infraestrutura e apresentação.
 */
import type {CollaboratorDocument} from "../../domain/aggregates/collaborator-document.js";
import type {DocumentStatusValue} from "../../domain/value-objects/document-status.js";

/**
 * Representação primitiva e imutável do vínculo na fronteira da aplicação.
 *
 * @remarks
 * Datas são expressas como strings ISO 8601 (ou `null`) e `versionCount` é
 * derivado do tamanho de `versions`.
 */
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

/**
 * Converte o agregado de domínio para a saída primitiva da aplicação.
 *
 * @param document - Agregado de vínculo documental a serializar.
 * @returns Saída imutável com datas em ISO 8601 e `versionCount` derivado.
 */
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
