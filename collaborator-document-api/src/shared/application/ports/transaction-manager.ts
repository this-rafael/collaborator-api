import type {Result} from "neverthrow";

import type {TransactionContext} from "../../domain/transaction-context.js";
import type {ApplicationFailure} from "../errors/application-failure.js";

export type {TransactionContext} from "../../domain/transaction-context.js";

/** Falhas técnicas possíveis ao controlar uma transação. */
export type TransactionFailure = ApplicationFailure<
  "SERVICE_UNAVAILABLE" | "INTERNAL_SERVER_ERROR"
>;

/** Porta de execução transacional independente do mecanismo de persistência. */
export interface TransactionManager {
  execute<T, E>(
    work: (context: TransactionContext) => Promise<Result<T, E>>
  ): Promise<Result<T, E | TransactionFailure>>;
}
