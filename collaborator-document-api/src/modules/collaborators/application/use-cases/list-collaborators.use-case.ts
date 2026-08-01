import {err, ok, type Result} from "neverthrow";

import {Cpf} from "../../domain/value-objects/cpf.js";
import {Email} from "../../domain/value-objects/email.js";
import {
  collaboratorApplicationFailure,
  type CollaboratorFailure
} from "../../domain/errors/collaborator.failure.js";
import type {
  CollaboratorListFiltersInput,
  ListCollaboratorsInput
} from "../contracts/collaborator-input.js";
import {
  collaboratorToOutput,
  type ListCollaboratorsOutput
} from "../contracts/collaborator-output.js";
import type {
  CollaboratorListFilters,
  CollaboratorRepository
} from "../../domain/repositories/collaborator.repository.js";

/**
 * Normaliza filtros sem permitir detalhes HTTP ou banco na camada de aplicação.
 *
 * @param input - Filtros brutos de listagem (nome, cpf e/ou e-mail).
 * @returns Result com os filtros normalizados em sucesso (nome sem acentos e em
 * minúsculas, e-mail aparado em minúsculas); em falha, `CollaboratorFailure`
 * com código `INVALID_QUERY_PARAMETER` quando a entrada não é objeto, o cpf não
 * tem 11 dígitos ou o e-mail é inválido.
 */
export function normalizeCollaboratorFilters(
  input: CollaboratorListFiltersInput
): Result<CollaboratorListFilters, CollaboratorFailure> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return err(
      collaboratorApplicationFailure("INVALID_QUERY_PARAMETER", "filters must be an object")
    );
  }
  if (input.cpf !== undefined && Cpf.create(input.cpf).isErr()) {
    return err(
      collaboratorApplicationFailure(
        "INVALID_QUERY_PARAMETER",
        "cpf must contain exactly 11 digits"
      )
    );
  }
  if (input.email !== undefined && Email.create(input.email).isErr()) {
    return err(collaboratorApplicationFailure("INVALID_QUERY_PARAMETER", "email is invalid"));
  }

  return ok({
    name: input.name
      ?.trim()
      .replace(/\s+/g, " ")
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLocaleLowerCase("pt-BR"),
    cpf: input.cpf,
    email: input.email?.trim().toLowerCase()
  });
}

/** Lista colaboradores ativos usando paginação keyset já validada pela aplicação. */
export class ListCollaboratorsUseCase {
  /**
   * @param repository - Porta de persistência restrita à listagem de ativos.
   */
  constructor(private readonly repository: Pick<CollaboratorRepository, "listActive">) {}

  /**
   * Executa a listagem paginada de colaboradores ativos.
   *
   * @param input - Filtros, `limit` (1 a 100) e cursor `afterId` opcional.
   * @returns Result com a página `ListCollaboratorsOutput` em sucesso; em falha,
   * `CollaboratorFailure` com código `INVALID_QUERY_PARAMETER` (limite ou filtro
   * inválido) ou códigos de infraestrutura como `SERVICE_UNAVAILABLE` e
   * `INTERNAL_SERVER_ERROR`.
   */
  async execute(
    input: ListCollaboratorsInput
  ): Promise<Result<ListCollaboratorsOutput, CollaboratorFailure>> {
    if (
      !input ||
      typeof input !== "object" ||
      !Number.isInteger(input.limit) ||
      input.limit < 1 ||
      input.limit > 100
    ) {
      return err(
        collaboratorApplicationFailure("INVALID_QUERY_PARAMETER", "limit must be between 1 and 100")
      );
    }

    const filters = normalizeCollaboratorFilters(input.filters);
    if (filters.isErr()) return err(filters.error);

    const page = await this.repository.listActive({...input, filters: filters.value});
    if (page.isErr()) return err(page.error);
    return ok({
      items: page.value.items.map(collaboratorToOutput),
      hasNext: page.value.hasNext,
      filters: filters.value
    });
  }
}
