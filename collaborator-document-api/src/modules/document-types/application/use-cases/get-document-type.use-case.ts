import type {ResultAsync} from "neverthrow";

import type {DocumentTypeFailure} from "../../domain/errors/document-type.failure.js";
import type {DocumentTypeIdInput} from "../contracts/document-type-input.js";
import {documentTypeToOutput, type DocumentTypeOutput} from "../contracts/document-type-output.js";
import type {DocumentTypeRepository} from "../../domain/repositories/document-type.repository.js";

export class GetDocumentTypeUseCase {
  constructor(private readonly repository: Pick<DocumentTypeRepository, "findById">) {}

  execute(input: DocumentTypeIdInput): ResultAsync<DocumentTypeOutput, DocumentTypeFailure> {
    return this.repository.findById(input.id).map(documentTypeToOutput);
  }
}
