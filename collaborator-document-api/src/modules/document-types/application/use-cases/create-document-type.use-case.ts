import {errAsync, type ResultAsync} from "neverthrow";

import type {Clock} from "../../../../shared/application/ports/clock.js";
import type {IdGenerator} from "../../../../shared/application/ports/id-generator.js";
import {DocumentType} from "../../domain/entities/document-type.js";
import {
  documentTypeApplicationFailure,
  type DocumentTypeFailure
} from "../../domain/errors/document-type.failure.js";
import type {CreateDocumentTypeInput} from "../contracts/document-type-input.js";
import {documentTypeToOutput, type DocumentTypeOutput} from "../contracts/document-type-output.js";
import type {DocumentTypeRepository} from "../../domain/repositories/document-type.repository.js";

export class CreateDocumentTypeUseCase {
  constructor(
    private readonly repository: Pick<DocumentTypeRepository, "create">,
    private readonly clock: Clock,
    private readonly ids: IdGenerator
  ) {}

  execute(input: CreateDocumentTypeInput): ResultAsync<DocumentTypeOutput, DocumentTypeFailure> {
    let id: string;
    let now: Date;
    try {
      id = this.ids.next();
      now = this.clock.now();
    } catch {
      return errAsync(
        documentTypeApplicationFailure(
          "INTERNAL_SERVER_ERROR",
          "Document type creation dependencies failed."
        )
      );
    }

    const documentType = DocumentType.create({...input, id}, now);
    if (documentType.isErr()) return errAsync(documentType.error);

    return this.repository.create(documentType.value).map(documentTypeToOutput);
  }
}
