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

/**
 * Normaliza filtros de listagem: padroniza o nome (colapsa espaços, remove
 * acentos e aplica caixa baixa pt-BR) e valida o código quando informado.
 *
 * @param input - Filtros brutos vindos da fronteira da aplicação.
 * @returns Result com os filtros normalizados em sucesso; em falha,
 * `DocumentTypeFailure` com código `INVALID_QUERY_PARAMETER` quando o objeto de
 * filtros é inválido ou o código não é canônico.
 */
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

/** Caso de uso para listagem paginada de tipos de documento ativos. */
export class ListDocumentTypesUseCase {
  /**
   * @param repository - Repositório usado para listar os tipos ativos.
   */
  constructor(private readonly repository: Pick<DocumentTypeRepository, "listActive">) {}

  /**
   * Lista tipos de documento ativos com filtros normalizados e paginação keyset.
   *
   * @param input - Filtros, limite (1 a 100) e cursor opcional da listagem.
   * @returns Result com `ListDocumentTypesOutput` em sucesso; em falha,
   * `DocumentTypeFailure` com código `INVALID_QUERY_PARAMETER` (limite ou filtros
   * inválidos) ou `SERVICE_UNAVAILABLE`.
   */
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
