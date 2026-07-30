import type {CollaboratorDocumentOutput} from "../../../application/contracts/collaborator-document-output.js";

type HalLink = Readonly<{href: string; method?: "DELETE" | "POST"}>;

/** Representação HAL de um vínculo documental. */
export type CollaboratorDocumentHal = Readonly<{
  id: string;
  collaboratorId: string;
  documentTypeId: string;
  status: "PENDING" | "SUBMITTED";
  currentVersion: number;
  lastSubmittedAt: string | null;
  linkedAt: string;
  unlinkedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  _links: Readonly<Record<string, HalLink>>;
}>;

/** Converte a saída primitiva para HAL condicional ao estado. */
export const collaboratorDocumentPresenter = (
  document: CollaboratorDocumentOutput
): CollaboratorDocumentHal => {
  const href = `/api/v1/collaborator-documents/${document.id}`;
  const links: Record<string, HalLink> = {
    self: {href},
    collaborator: {href: `/api/v1/collaborators/${document.collaboratorId}`},
    "document-type": {href: `/api/v1/document-types/${document.documentTypeId}`},
    versions: {href: `${href}/versions`}
  };

  const isHistorical = document.deletedAt !== null || document.unlinkedAt !== null;
  if (!isHistorical) {
    links.unlink = {href, method: "DELETE"};
    if (document.status === "PENDING") {
      links["submit-version"] = {href: `${href}/versions`, method: "POST"};
    } else {
      links["current-version"] = {href: `${href}/versions/${document.currentVersion}`};
      links["resubmit-version"] = {href: `${href}/versions`, method: "POST"};
    }
  }

  return {
    id: document.id,
    collaboratorId: document.collaboratorId,
    documentTypeId: document.documentTypeId,
    status: document.status,
    currentVersion: document.currentVersion,
    lastSubmittedAt: document.lastSubmittedAt,
    linkedAt: document.linkedAt,
    unlinkedAt: document.unlinkedAt,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    deletedAt: document.deletedAt,
    _links: links
  };
};
