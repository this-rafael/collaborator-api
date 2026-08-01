declare const transactionContextBrand: unique symbol;

/**
 * Contexto opaco que vincula operações persistentes à mesma transação.
 *
 * @remarks O domínio pode encaminhá-lo para um repositório, mas somente
 *   adaptadores de infraestrutura sabem qual sessão técnica está associada a
 *   ele. O tipo é "branded" para impedir a criação de instâncias fora da
 *   camada de infraestrutura.
 */
export type TransactionContext = Readonly<{
  readonly [transactionContextBrand]: true;
}>;
