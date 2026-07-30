import {err, ok, type Result} from "neverthrow";

import {
  documentTypeDomainFailure,
  type DocumentTypeDomainFailure
} from "../errors/document-type.failure.js";

const CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,63}$/;

/** Código canônico de tipo de documento (maiúsculas, underscore, 2–64). */
export class DocumentTypeCode {
  private constructor(readonly value: string) {}

  static create(input: unknown): Result<DocumentTypeCode, DocumentTypeDomainFailure> {
    if (typeof input !== "string") {
      return err(documentTypeDomainFailure("VALIDATION_ERROR", "code must be a string"));
    }
    if (!CODE_PATTERN.test(input)) {
      return err(
        documentTypeDomainFailure("VALIDATION_ERROR", "code must match ^[A-Z][A-Z0-9_]{1,63}$")
      );
    }
    return ok(new DocumentTypeCode(input));
  }
}
