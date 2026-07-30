import {err, ok, type Result} from "neverthrow";

import {
  collaboratorDomainFailure,
  type CollaboratorDomainFailure
} from "../errors/collaborator.failure.js";

/** E-mail normalizado para lowercase e validado para o agregado. */
export class Email {
  private constructor(readonly value: string) {}

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
