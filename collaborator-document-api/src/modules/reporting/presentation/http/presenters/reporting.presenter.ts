import type {PendingDocumentView} from "../../../application/models/pending-document.view.js";

/** Adapta a projeção de pendência para uma representação HAL. */
export const pendingDocumentPresenter = (pending: PendingDocumentView) => ({
  ...pending,
  _links: {
    self: {href: `/api/v1/collaborator-documents/${pending.id}`},
    collaborator: {href: `/api/v1/collaborators/${pending.collaborator.id}`},
    documentType: {href: `/api/v1/document-types/${pending.documentType.id}`}
  }
});
