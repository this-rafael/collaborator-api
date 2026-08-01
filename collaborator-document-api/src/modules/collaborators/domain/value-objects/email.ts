import {err, ok, type Result} from "neverthrow";

import {
  collaboratorDomainFailure,
  type CollaboratorDomainFailure
} from "../errors/collaborator.failure.js";

/**
 * E-mail normalizado para lowercase e validado para o agregado.
 *
 * @remarks
 * Value Object imutável. O texto é aparado e convertido para minúsculas antes
 * da validação de formato, do limite total (320 caracteres) e do tamanho da
 * parte local (64 caracteres). Só pode ser instanciado por meio do método
 * estático `create`.
 */
export class Email {
  private constructor(
    /** Endereço de e-mail já normalizado (aparado e em minúsculas). */
    readonly value: string
  ) {}

  /**
   * Cria um e-mail normalizado e validado a partir de uma entrada bruta.
   *
   * @param input - Valor bruto informado; deve ser uma string.
   * @returns Result com o `Email` em caso de sucesso; em falha,
   * `CollaboratorDomainFailure` com código `VALIDATION_ERROR` quando a entrada
   * não é string ou não satisfaz o formato/limites de e-mail.
   */
  static create(input: unknown): Result<Email, CollaboratorDomainFailure> {
    if (typeof input !== "string") {
      return err(collaboratorDomainFailure("VALIDATION_ERROR", "email must be a string"));
    }

    const value = input.trim().toLowerCase();
    const [localPart] = value.split("@");
    if (
      value.length > 320 ||
      !localPart ||
      localPart.length > 64 ||
      !/^[^\s@]+@[^\s@.]+\.[^\s@]+$/.test(value)
    ) {
      return err(collaboratorDomainFailure("VALIDATION_ERROR", "email is invalid"));
    }

    return ok(new Email(value));
  }
}
