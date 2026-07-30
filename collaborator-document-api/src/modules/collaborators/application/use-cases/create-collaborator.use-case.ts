import {errAsync, type ResultAsync} from "neverthrow";

import type {Clock} from "../../../../shared/application/ports/clock.js";
import type {IdGenerator} from "../../../../shared/application/ports/id-generator.js";
import {Collaborator} from "../../domain/entities/collaborator.js";
import {
  collaboratorApplicationFailure,
  type CollaboratorFailure
} from "../../domain/errors/collaborator.failure.js";
import type {CreateCollaboratorInput} from "../contracts/collaborator-input.js";
import {collaboratorToOutput, type CollaboratorOutput} from "../contracts/collaborator-output.js";
import type {CollaboratorRepository} from "../../domain/repositories/collaborator.repository.js";

/** Cria e persiste um agregado com identificador e relógio injetados. */
export class CreateCollaboratorUseCase {
  constructor(
    private readonly repository: Pick<CollaboratorRepository, "create">,
    private readonly clock: Clock,
    private readonly ids: IdGenerator
  ) {}

  execute(input: CreateCollaboratorInput): ResultAsync<CollaboratorOutput, CollaboratorFailure> {
    let id: string;
    let now: Date;
    try {
      id = this.ids.next();
      now = this.clock.now();
    } catch {
      return errAsync(
        collaboratorApplicationFailure(
          "INTERNAL_SERVER_ERROR",
          "Collaborator creation dependencies failed."
        )
      );
    }

    const collaborator = Collaborator.create({...input, id}, now);
    if (collaborator.isErr()) return errAsync(collaborator.error);

    return this.repository.create(collaborator.value).map(collaboratorToOutput);
  }
}
