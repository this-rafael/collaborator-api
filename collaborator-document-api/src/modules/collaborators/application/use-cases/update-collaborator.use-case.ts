import {errAsync, type ResultAsync} from "neverthrow";

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

  execute(input: UpdateCollaboratorInput): ResultAsync<CollaboratorOutput, CollaboratorFailure> {
    return this.repository.findById(input.id).andThen((existing) => {
      let now: Date;
      try {
        now = this.clock.now();
      } catch {
        return errAsync(
          collaboratorApplicationFailure(
            "INTERNAL_SERVER_ERROR",
            "Collaborator clock is unavailable."
          )
        );
      }
      const updated = existing.update(input.patch, now);
      if (updated.isErr()) return errAsync(updated.error);
      return this.repository.updateActive(updated.value).map(collaboratorToOutput);
    });
  }
}
