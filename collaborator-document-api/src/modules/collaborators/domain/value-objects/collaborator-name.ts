import {err, ok, type Result} from "neverthrow";

import {
  collaboratorDomainFailure,
  type CollaboratorDomainFailure
} from "../errors/collaborator.failure.js";

/** Nome normalizado e validado de um colaborador. */
export class CollaboratorName {
  private constructor(readonly value: string) {}

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
