/**
 * Porta para obtenção da data/hora corrente.
 *
 * @remarks Usada para permitir injeção de relógio
 *   controlado em testes.
 */
export interface Clock {
  /**
   * Obtém o instante atual.
   *
   * @returns A data/hora corrente no momento da chamada.
   */
  now(): Date;
}
