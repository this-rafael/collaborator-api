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
  /**
   * @param repository - Porta de persistência restrita à busca e à atualização de ativos.
   * @param clock - Relógio injetado usado para carimbar a data de atualização.
   */
  constructor(
    private readonly repository: Pick<CollaboratorRepository, "findById" | "updateActive">,
    private readonly clock: Clock
  ) {}

  /**
   * Executa a atualização parcial do colaborador.
   *
   * @param input - Identificador do colaborador e o patch com os campos a alterar.
   * @returns Result com o `CollaboratorOutput` atualizado em sucesso; em falha,
   * `CollaboratorFailure` com códigos como `COLLABORATOR_NOT_FOUND`,
   * `COLLABORATOR_DELETED`, `VALIDATION_ERROR`, `INTERNAL_SERVER_ERROR`
   * (relógio indisponível), `DUPLICATE_ACTIVE_CPF`, `DUPLICATE_ACTIVE_EMAIL` ou
   * `SERVICE_UNAVAILABLE`.
   */
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
