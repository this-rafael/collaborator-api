/**
 * Porta para obtenção da data/hora corrente.
 *
 * @remarks Usada para permitir injeção de relógio
 *   controlado em testes.
 */
export interface Clock {
  now(): Date;
}
