import {err, ok, type Result} from "neverthrow";

import type {CollaboratorFailure} from "../../domain/errors/collaborator.failure.js";
import type {CollaboratorIdInput} from "../contracts/collaborator-input.js";
import {collaboratorToOutput, type CollaboratorOutput} from "../contracts/collaborator-output.js";
import type {CollaboratorRepository} from "../../domain/repositories/collaborator.repository.js";

/** Consulta um colaborador, incluindo o histórico soft-deletado quando existir. */
export class GetCollaboratorUseCase {
  /**
   * @param repository - Porta de persistência restrita à busca por identificador.
   */
  constructor(private readonly repository: Pick<CollaboratorRepository, "findById">) {}

  /**
   * Executa a consulta do colaborador por identificador.
   *
   * @param input - Identificador do colaborador a consultar.
   * @returns Result com o `CollaboratorOutput` em sucesso (ativo ou já excluído);
   * em falha, `CollaboratorFailure` com códigos como `VALIDATION_ERROR`,
   * `COLLABORATOR_NOT_FOUND`, `SERVICE_UNAVAILABLE` ou `INTERNAL_SERVER_ERROR`.
   */
  async execute(
    input: CollaboratorIdInput
  ): Promise<Result<CollaboratorOutput, CollaboratorFailure>> {
    const found = await this.repository.findById(input.id);
    if (found.isErr()) return err(found.error);
    return ok(collaboratorToOutput(found.value));
  }
}
