import type {Result} from "neverthrow";

import type {TransactionContext} from "../../domain/transaction-context.js";
import type {ApplicationFailure} from "../errors/application-failure.js";

/** Contexto de transação compartilhado entre módulos. */
export type {TransactionContext} from "../../domain/transaction-context.js";

/** Falhas técnicas possíveis ao controlar uma transação. */
export type TransactionFailure = ApplicationFailure<
  "SERVICE_UNAVAILABLE" | "INTERNAL_SERVER_ERROR"
>;

/** Porta de execução transacional independente do mecanismo de persistência. */
export interface TransactionManager {
  /**
   * Executa uma unidade de trabalho dentro de uma transação, aplicando commit
   * em caso de sucesso e rollback em caso de falha.
   *
   * @typeParam T - Tipo do valor de sucesso produzido pelo trabalho.
   * @typeParam E - Tipo de falha de domínio/aplicação retornado pelo trabalho.
   * @param work - Função que recebe o {@link TransactionContext} e retorna um
   *   `Result`; deve encaminhar o contexto aos repositórios envolvidos.
   * @returns Result com o valor de sucesso do trabalho; em falha, o erro `E`
   *   original ou uma `TransactionFailure` com códigos SERVICE_UNAVAILABLE ou
   *   INTERNAL_SERVER_ERROR quando o controle da transação falha.
   */
  execute<T, E>(
    work: (context: TransactionContext) => Promise<Result<T, E>>
  ): Promise<Result<T, E | TransactionFailure>>;
}
