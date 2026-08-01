import {err, ok, type Result} from "neverthrow";

import {
  collaboratorDomainFailure,
  type CollaboratorDomainFailure
} from "../errors/collaborator.failure.js";

/**
 * CPF estruturalmente válido, armazenado com onze dígitos.
 *
 * @remarks
 * Value Object imutável. A validação é apenas estrutural (exatamente 11
 * dígitos numéricos); não confere os dígitos verificadores do CPF. Só pode ser
 * instanciado por meio do método estático `create`.
 */
export class Cpf {
  private constructor(
    /** Sequência com exatamente 11 dígitos que representa o CPF. */
    readonly value: string
  ) {}

  /**
   * Cria um CPF validado estruturalmente a partir de uma entrada bruta.
   *
   * @param input - Valor bruto informado; deve ser uma string com 11 dígitos.
   * @returns Result com o `Cpf` em caso de sucesso; em falha,
   * `CollaboratorDomainFailure` com código `VALIDATION_ERROR` quando a entrada
   * não contém exatamente 11 dígitos.
   */
  static create(input: unknown): Result<Cpf, CollaboratorDomainFailure> {
    if (typeof input !== "string" || !/^\d{11}$/.test(input)) {
      return err(
        collaboratorDomainFailure("VALIDATION_ERROR", "cpf must contain exactly 11 digits")
      );
    }

    return ok(new Cpf(input));
  }
}
