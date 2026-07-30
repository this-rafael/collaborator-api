import {err, ok, type Result} from "neverthrow";

import type {Clock} from "../../../../shared/application/ports/clock.js";
import {
  collaboratorApplicationFailure,
  type CollaboratorFailure
} from "../../domain/errors/collaborator.failure.js";
import type {UpdateCollaboratorInput} from "../contracts/collaborator-input.js";
import {collaboratorToOutput, type CollaboratorOutput} from "../contracts/collaborator-output.js";
import type {CollaboratorRepository} from "../../domain/repositories/collaborator.repository.js";

/** Atualiza o agregado de forma imutável antes de persistir a transição. */
export class UpdateCollaboratorUseCase {
  constructor(
    private readonly repository: Pick<CollaboratorRepository, "findById" | "updateActive">,
    private readonly clock: Clock
  ) {}

  async execute(
    input: UpdateCollaboratorInput
  ): Promise<Result<CollaboratorOutput, CollaboratorFailure>> {
    const found = await this.repository.findById(input.id);
    if (found.isErr()) return err(found.error);

    let now: Date;
    try {
      now = this.clock.now();
    } catch {
      return err(
        collaboratorApplicationFailure(
          "INTERNAL_SERVER_ERROR",
          "Collaborator clock is unavailable."
        )
      );
    }
    const updated = found.value.update(input.patch, now);
    if (updated.isErr()) return err(updated.error);

    const persisted = await this.repository.updateActive(updated.value);
    if (persisted.isErr()) return err(persisted.error);
    return ok(collaboratorToOutput(persisted.value));
  }
}
