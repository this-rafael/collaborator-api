import type {Result} from "neverthrow";

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
  /**
   * Persiste um colaborador recém-criado.
   *
   * @param collaborator - Agregado válido a ser inserido.
   * @returns Result com o colaborador persistido em sucesso; em falha,
   * `CollaboratorFailure` com códigos como `DUPLICATE_ACTIVE_CPF`,
   * `DUPLICATE_ACTIVE_EMAIL`, `SERVICE_UNAVAILABLE` ou `INTERNAL_SERVER_ERROR`.
   */
  create(collaborator: Collaborator): Promise<Result<Collaborator, CollaboratorFailure>>;
  /**
   * Busca um colaborador por identificador, incluindo os já excluídos logicamente.
   *
   * @param id - Identificador do colaborador.
   * @returns Result com o colaborador em sucesso; em falha, `CollaboratorFailure`
   * com códigos como `VALIDATION_ERROR`, `COLLABORATOR_NOT_FOUND`,
   * `SERVICE_UNAVAILABLE` ou `INTERNAL_SERVER_ERROR`.
   */
  findById(id: string): Promise<Result<Collaborator, CollaboratorFailure>>;
  /**
   * Lista colaboradores ativos aplicando filtros e paginação keyset.
   *
   * @param input - Filtros de domínio, cursor `afterId` opcional e `limit` da página.
   * @returns Result com a página de colaboradores ativos em sucesso; em falha,
   * `CollaboratorFailure` com códigos como `INVALID_QUERY_PARAMETER`,
   * `SERVICE_UNAVAILABLE` ou `INTERNAL_SERVER_ERROR`.
   */
  listActive(input: {
    filters: CollaboratorListFilters;
    afterId?: string;
    limit: number;
  }): Promise<Result<CollaboratorListPage, CollaboratorFailure>>;
  /**
   * Atualiza um colaborador ainda ativo.
   *
   * @param collaborator - Agregado já transicionado a ser persistido.
   * @returns Result com o colaborador atualizado em sucesso; em falha,
   * `CollaboratorFailure` com códigos como `COLLABORATOR_NOT_FOUND`,
   * `COLLABORATOR_DELETED`, `DUPLICATE_ACTIVE_CPF`, `DUPLICATE_ACTIVE_EMAIL`,
   * `SERVICE_UNAVAILABLE` ou `INTERNAL_SERVER_ERROR`.
   */
  updateActive(collaborator: Collaborator): Promise<Result<Collaborator, CollaboratorFailure>>;
  /**
   * Aplica o soft delete de um colaborador ativo dentro de uma transação.
   *
   * @param collaborator - Agregado já marcado como excluído.
   * @param context - Contexto de transação opaco coordenado pelo caso de uso.
   * @returns Result com `true` quando uma linha ativa foi excluída e `false`
   * quando não havia colaborador ativo a excluir; em falha, `CollaboratorFailure`
   * com códigos como `SERVICE_UNAVAILABLE` ou `INTERNAL_SERVER_ERROR`.
   * @remarks
   * A exclusão em cascata dos vínculos relacionados é orquestrada pelo caso de
   * uso na mesma transação MongoDB.
   */
  softDeleteActive(
    collaborator: Collaborator,
    context: TransactionContext
  ): Promise<Result<boolean, CollaboratorFailure>>;
}
