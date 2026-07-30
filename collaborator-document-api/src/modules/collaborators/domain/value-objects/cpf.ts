import {err, ok, type Result} from "neverthrow";

import {
  collaboratorDomainFailure,
  type CollaboratorDomainFailure
} from "../errors/collaborator.failure.js";

/** CPF estruturalmente válido, armazenado com onze dígitos. */
export class Cpf {
  private constructor(readonly value: string) {}

  static create(input: unknown): Result<Cpf, CollaboratorDomainFailure> {
    if (typeof input !== "string" || !/^\d{11}$/.test(input)) {
      return err(
        collaboratorDomainFailure("VALIDATION_ERROR", "cpf must contain exactly 11 digits")
      );
    }

    return ok(new Cpf(input));
  }
}
