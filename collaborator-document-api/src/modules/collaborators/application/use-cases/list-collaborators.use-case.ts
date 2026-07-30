import {err, errAsync, ok, type Result, type ResultAsync} from "neverthrow";

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

/** Normaliza filtros sem permitir detalhes HTTP ou banco na camada de aplicação. */
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
  constructor(private readonly repository: Pick<CollaboratorRepository, "listActive">) {}

  execute(
    input: ListCollaboratorsInput
  ): ResultAsync<ListCollaboratorsOutput, CollaboratorFailure> {
    if (
      !input ||
      typeof input !== "object" ||
      !Number.isInteger(input.limit) ||
      input.limit < 1 ||
      input.limit > 100
    ) {
      return errAsync(
        collaboratorApplicationFailure("INVALID_QUERY_PARAMETER", "limit must be between 1 and 100")
      );
    }

    const filters = normalizeCollaboratorFilters(input.filters);
    if (filters.isErr()) return errAsync(filters.error);

    return this.repository.listActive({...input, filters: filters.value}).map((page) => ({
      items: page.items.map(collaboratorToOutput),
      hasNext: page.hasNext,
      filters: filters.value
    }));
  }
}
