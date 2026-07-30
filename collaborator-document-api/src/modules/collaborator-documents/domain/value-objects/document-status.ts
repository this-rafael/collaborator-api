import {err, ok, type Result} from "neverthrow";

import {
  collaboratorDocumentDomainFailure,
  type CollaboratorDocumentDomainFailure
} from "../errors/collaborator-document.failure.js";

/** Status documental permitido pelo domínio. */
export type DocumentStatusValue = "PENDING" | "SUBMITTED";

/** Value object para o status do vínculo documental. */
export class DocumentStatus {
  private constructor(readonly value: DocumentStatusValue) {}

  static create(value: unknown): Result<DocumentStatus, CollaboratorDocumentDomainFailure> {
    if (value === "PENDING" || value === "SUBMITTED") return ok(new DocumentStatus(value));
    return err(
      collaboratorDocumentDomainFailure("VALIDATION_ERROR", "status must be PENDING or SUBMITTED")
    );
  }
}
