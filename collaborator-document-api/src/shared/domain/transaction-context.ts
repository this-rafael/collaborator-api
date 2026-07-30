/**
 * Contexto opaco que vincula operações persistentes à mesma transação.
 *
 * O domínio pode encaminhá-lo para um repositório, mas somente adaptadores de
 * infraestrutura sabem qual sessão técnica está associada a ele.
 */
declare const transactionContextBrand: unique symbol;

export type TransactionContext = Readonly<{
  readonly [transactionContextBrand]: true;
}>;
