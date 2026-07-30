import {err, ok, type Result} from "neverthrow";

import type {CollaboratorFailure} from "../../domain/errors/collaborator.failure.js";
import type {CollaboratorIdInput} from "../contracts/collaborator-input.js";
import {collaboratorToOutput, type CollaboratorOutput} from "../contracts/collaborator-output.js";
import type {CollaboratorRepository} from "../../domain/repositories/collaborator.repository.js";

/** Consulta um colaborador, incluindo o histórico soft-deletado quando existir. */
export class GetCollaboratorUseCase {
  constructor(private readonly repository: Pick<CollaboratorRepository, "findById">) {}

  async execute(
    input: CollaboratorIdInput
  ): Promise<Result<CollaboratorOutput, CollaboratorFailure>> {
    const found = await this.repository.findById(input.id);
    if (found.isErr()) return err(found.error);
    return ok(collaboratorToOutput(found.value));
  }
}
