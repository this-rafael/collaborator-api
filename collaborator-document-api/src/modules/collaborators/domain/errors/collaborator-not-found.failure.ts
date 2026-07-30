import {
  collaboratorApplicationFailure,
  type CollaboratorApplicationFailure
} from "./collaborator.failure.js";

/** Falha estável para uma consulta de colaborador inexistente. */
export const collaboratorNotFoundFailure = (): CollaboratorApplicationFailure =>
  collaboratorApplicationFailure("COLLABORATOR_NOT_FOUND", "Collaborator was not found.");
