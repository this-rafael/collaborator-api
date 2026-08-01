/** Gera identificadores antes da persistência do agregado. */
export interface IdGenerator {
  /**
   * Gera o próximo identificador único.
   *
   * @returns Novo identificador em formato de string, pronto para atribuição
   *   ao agregado antes da persistência.
   */
  next(): string;
}
