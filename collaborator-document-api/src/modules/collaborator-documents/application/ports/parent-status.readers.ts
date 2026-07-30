import type {Result} from "neverthrow";

import type {CollaboratorDocumentFailure} from "../../domain/errors/collaborator-document.failure.js";

/** Status pai apto para criar vínculo. */
export type ParentStatus = "ACTIVE";

/** Lê o status público de um colaborador sem acoplar à infra alheia. */
export interface CollaboratorStatusReader {
  read(collaboratorId: string): Promise<Result<ParentStatus, CollaboratorDocumentFailure>>;
}

/** Lê o status público de um tipo de documento sem acoplar à infra alheia. */
export interface DocumentTypeStatusReader {
  read(documentTypeId: string): Promise<Result<ParentStatus, CollaboratorDocumentFailure>>;
}
