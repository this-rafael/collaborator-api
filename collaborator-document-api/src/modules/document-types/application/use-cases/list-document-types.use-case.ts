import {err, ok, type Result} from "neverthrow";

import {DocumentTypeCode} from "../../domain/value-objects/document-type-code.js";
import {
  documentTypeApplicationFailure,
  type DocumentTypeFailure
} from "../../domain/errors/document-type.failure.js";
import type {
  DocumentTypeListFiltersInput,
  ListDocumentTypesInput
} from "../contracts/document-type-input.js";
import {
  documentTypeToOutput,
  type ListDocumentTypesOutput
} from "../contracts/document-type-output.js";
import type {
  DocumentTypeListFilters,
  DocumentTypeRepository
} from "../../domain/repositories/document-type.repository.js";

export function normalizeDocumentTypeFilters(
  input: DocumentTypeListFiltersInput
): Result<DocumentTypeListFilters, DocumentTypeFailure> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return err(
      documentTypeApplicationFailure("INVALID_QUERY_PARAMETER", "filters must be an object")
    );
  }
  if (input.code !== undefined) {
    const code = DocumentTypeCode.create(input.code);
    if (code.isErr()) {
      return err(
        documentTypeApplicationFailure(
          "INVALID_QUERY_PARAMETER",
          "code must be a canonical document type code",
          [
            {
              field: "code",
              code: "INVALID_QUERY_PARAMETER",
              message: "Informe um código canônico válido."
            }
          ]
        )
      );
    }
  }

  return ok({
    name: input.name
      ?.trim()
      .replace(/\s+/g, " ")
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLocaleLowerCase("pt-BR"),
    code: typeof input.code === "string" ? input.code : undefined
  });
}

export class ListDocumentTypesUseCase {
  constructor(private readonly repository: Pick<DocumentTypeRepository, "listActive">) {}

  async execute(
    input: ListDocumentTypesInput
  ): Promise<Result<ListDocumentTypesOutput, DocumentTypeFailure>> {
    if (
      !input ||
      typeof input !== "object" ||
      !Number.isInteger(input.limit) ||
      input.limit < 1 ||
      input.limit > 100
    ) {
      return err(
        documentTypeApplicationFailure("INVALID_QUERY_PARAMETER", "limit must be between 1 and 100")
      );
    }

    const filters = normalizeDocumentTypeFilters(input.filters);
    if (filters.isErr()) return err(filters.error);

    const page = await this.repository.listActive({...input, filters: filters.value});
    if (page.isErr()) return err(page.error);
    return ok({
      items: page.value.items.map(documentTypeToOutput),
      hasNext: page.value.hasNext,
      filters: filters.value
    });
  }
}
