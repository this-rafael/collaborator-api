import {errAsync, type ResultAsync} from "neverthrow";

import type {Clock} from "../../../../shared/application/ports/clock.js";
import {
  documentTypeApplicationFailure,
  type DocumentTypeFailure
} from "../../domain/errors/document-type.failure.js";
import type {UpdateDocumentTypeInput} from "../contracts/document-type-input.js";
import {documentTypeToOutput, type DocumentTypeOutput} from "../contracts/document-type-output.js";
import type {DocumentTypeRepository} from "../../domain/repositories/document-type.repository.js";

export class UpdateDocumentTypeUseCase {
  constructor(
    private readonly repository: Pick<DocumentTypeRepository, "findById" | "updateActive">,
    private readonly clock: Clock
  ) {}

  execute(input: UpdateDocumentTypeInput): ResultAsync<DocumentTypeOutput, DocumentTypeFailure> {
    return this.repository.findById(input.id).andThen((existing) => {
      let now: Date;
      try {
        now = this.clock.now();
      } catch {
        return errAsync(
          documentTypeApplicationFailure(
            "INTERNAL_SERVER_ERROR",
            "Document type clock is unavailable."
          )
        );
      }
      const updated = existing.update(input.patch, now);
      if (updated.isErr()) return errAsync(updated.error);
      return this.repository.updateActive(updated.value).map(documentTypeToOutput);
    });
  }
}
