import {collaboratorDomainFailure, type CollaboratorDomainFailure} from "./collaborator.failure.js";

/**
 * Falha estável para uma transição proibida de um agregado já excluído.
 *
 * @returns `CollaboratorDomainFailure` com código `COLLABORATOR_DELETED`.
 */
export const collaboratorAlreadyDeletedFailure = (): CollaboratorDomainFailure =>
  collaboratorDomainFailure("COLLABORATOR_DELETED", "Collaborator has already been deleted.");
