import {err, ok, type Result} from "neverthrow";

import type {Clock} from "../../../../shared/application/ports/clock.js";
import {
  documentTypeApplicationFailure,
  type DocumentTypeFailure
} from "../../domain/errors/document-type.failure.js";
import type {UpdateDocumentTypeInput} from "../contracts/document-type-input.js";
import {documentTypeToOutput, type DocumentTypeOutput} from "../contracts/document-type-output.js";
import type {DocumentTypeRepository} from "../../domain/repositories/document-type.repository.js";

/** Caso de uso para atualização de um tipo de documento ativo. */
export class UpdateDocumentTypeUseCase {
  constructor(
    private readonly repository: Pick<DocumentTypeRepository, "findById" | "updateActive">,
    private readonly clock: Clock
  ) {}

  async execute(
    input: UpdateDocumentTypeInput
  ): Promise<Result<DocumentTypeOutput, DocumentTypeFailure>> {
    const found = await this.repository.findById(input.id);
    if (found.isErr()) return err(found.error);

    let now: Date;
    try {
      now = this.clock.now();
    } catch {
      return err(
        documentTypeApplicationFailure(
          "INTERNAL_SERVER_ERROR",
          "Document type clock is unavailable."
        )
      );
    }
    const updated = found.value.update(input.patch, now);
    if (updated.isErr()) return err(updated.error);

    const persisted = await this.repository.updateActive(updated.value);
    if (persisted.isErr()) return err(persisted.error);
    return ok(documentTypeToOutput(persisted.value));
  }
}
