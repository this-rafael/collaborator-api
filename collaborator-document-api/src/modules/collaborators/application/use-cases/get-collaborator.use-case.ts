import type {ResultAsync} from "neverthrow";

import type {CollaboratorFailure} from "../../domain/errors/collaborator.failure.js";
import type {CollaboratorIdInput} from "../contracts/collaborator-input.js";
import {collaboratorToOutput, type CollaboratorOutput} from "../contracts/collaborator-output.js";
import type {CollaboratorRepository} from "../../domain/repositories/collaborator.repository.js";

/** Consulta um colaborador, incluindo o histórico soft-deletado quando existir. */
export class GetCollaboratorUseCase {
  constructor(private readonly repository: Pick<CollaboratorRepository, "findById">) {}

  execute(input: CollaboratorIdInput): ResultAsync<CollaboratorOutput, CollaboratorFailure> {
    return this.repository.findById(input.id).map(collaboratorToOutput);
  }
}
