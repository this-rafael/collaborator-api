import {err, ok, type Result} from "neverthrow";

import {
  documentTypeDomainFailure,
  type DocumentTypeDomainFailure
} from "../errors/document-type.failure.js";

/** Nome normalizado e validado de um tipo de documento. */
export class DocumentTypeName {
  private constructor(readonly value: string) {}

  static create(input: unknown): Result<DocumentTypeName, DocumentTypeDomainFailure> {
    if (typeof input !== "string") {
      return err(documentTypeDomainFailure("VALIDATION_ERROR", "name must be a string"));
    }
    const value = input.trim().replace(/\s+/g, " ");
    if (value.length < 1 || value.length > 200) {
      return err(
        documentTypeDomainFailure("VALIDATION_ERROR", "name must contain 1 to 200 characters")
      );
    }
    return ok(new DocumentTypeName(value));
  }
}
