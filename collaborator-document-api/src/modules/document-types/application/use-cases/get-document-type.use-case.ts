import {err, ok, type Result} from "neverthrow";

import type {DocumentTypeFailure} from "../../domain/errors/document-type.failure.js";
import type {DocumentTypeIdInput} from "../contracts/document-type-input.js";
import {documentTypeToOutput, type DocumentTypeOutput} from "../contracts/document-type-output.js";
import type {DocumentTypeRepository} from "../../domain/repositories/document-type.repository.js";

/** Caso de uso para consulta de um tipo de documento por identificador. */
export class GetDocumentTypeUseCase {
  constructor(private readonly repository: Pick<DocumentTypeRepository, "findById">) {}

  async execute(
    input: DocumentTypeIdInput
  ): Promise<Result<DocumentTypeOutput, DocumentTypeFailure>> {
    const found = await this.repository.findById(input.id);
    if (found.isErr()) return err(found.error);
    return ok(documentTypeToOutput(found.value));
  }
}
