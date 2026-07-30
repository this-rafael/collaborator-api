import type {ResultAsync} from "neverthrow";

import type {TransactionContext} from "../../../../shared/domain/transaction-context.js";
import type {Collaborator} from "../entities/collaborator.js";
import type {CollaboratorFailure} from "../errors/collaborator.failure.js";

/**
 * Filtros expressos na linguagem do domínio para a lista de colaboradores.
 */
export type CollaboratorListFilters = Readonly<{name?: string; cpf?: string; email?: string}>;

/** Página de agregados retornada por uma consulta de colaboradores ativos. */
export type CollaboratorListPage = Readonly<{
  items: readonly Collaborator[];
  hasNext: boolean;
}>;

/**
 * Contrato de persistência que pertence ao domínio do agregado.
 *
 * Não contém detalhes de driver, framework ou transação. A operação que
 * precisa de uma transação é uma extensão da aplicação, pois depende de um
 * contexto opaco coordenado pelo caso de uso.
 */
export interface CollaboratorRepository {
  create(collaborator: Collaborator): ResultAsync<Collaborator, CollaboratorFailure>;
  findById(id: string): ResultAsync<Collaborator, CollaboratorFailure>;
  listActive(input: {
    filters: CollaboratorListFilters;
    afterId?: string;
    limit: number;
  }): ResultAsync<CollaboratorListPage, CollaboratorFailure>;
  updateActive(collaborator: Collaborator): ResultAsync<Collaborator, CollaboratorFailure>;
  softDeleteActive(
    collaborator: Collaborator,
    context: TransactionContext
  ): ResultAsync<boolean, CollaboratorFailure>;
}
