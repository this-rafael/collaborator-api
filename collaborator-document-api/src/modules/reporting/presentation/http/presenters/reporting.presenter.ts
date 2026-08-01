import type {LatestSubmissionView} from "../../../application/models/latest-submission.view.js";
import type {PendingDocumentTypeStatisticView} from "../../../application/models/pending-document-type-statistic.view.js";
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

/** Adapta o último envio projetado para uma representação HAL. */
export const latestSubmissionPresenter = (submission: LatestSubmissionView) => ({
  ...submission,
  _links: {
    self: {href: `/api/v1/collaborator-documents/${submission.documentId}`},
    collaborator: {href: `/api/v1/collaborators/${submission.collaborator.id}`},
    documentType: {href: `/api/v1/document-types/${submission.documentType.id}`}
  }
});

/** Adapta uma linha agregada do ranking para uma representação HAL. */
export const pendingDocumentTypeStatisticPresenter = (
  statistic: PendingDocumentTypeStatisticView
) => ({
  ...statistic,
  _links: {
    self: {href: `/api/v1/document-types/${statistic.documentType.id}`}
  }
});
