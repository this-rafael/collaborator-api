import {err, ok, type Result} from "neverthrow";

import {
  collaboratorDomainFailure,
  type CollaboratorDomainFailure
} from "../errors/collaborator.failure.js";

/**
 * Nome normalizado e validado de um colaborador.
 *
 * @remarks
 * Value Object imutável. O texto é aparado e tem os espaços internos colapsados
 * em um único espaço antes da validação de tamanho (1 a 200 caracteres). Só
 * pode ser instanciado por meio do método estático `create`.
 */
export class CollaboratorName {
  private constructor(
    /** Texto já normalizado do nome (aparado e com espaços colapsados). */
    readonly value: string
  ) {}

  /**
   * Cria um nome validado a partir de uma entrada bruta.
   *
   * @param input - Valor bruto informado; deve ser uma string.
   * @returns Result com o `CollaboratorName` em caso de sucesso; em falha,
   * `CollaboratorDomainFailure` com código `VALIDATION_ERROR` quando a entrada
   * não é string ou está fora do intervalo de 1 a 200 caracteres.
   */
  static create(input: unknown): Result<CollaboratorName, CollaboratorDomainFailure> {
    if (typeof input !== "string") {
      return err(collaboratorDomainFailure("VALIDATION_ERROR", "name must be a string"));
    }

    const value = input.trim().replace(/\s+/g, " ");
    if (value.length < 1 || value.length > 200) {
      return err(
        collaboratorDomainFailure("VALIDATION_ERROR", "name must contain 1 to 200 characters")
      );
    }

    return ok(new CollaboratorName(value));
  }
}
