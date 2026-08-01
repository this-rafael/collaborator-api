/**
 * Porta que representa o contexto de uma requisição HTTP.
 *
 * Carrega metadados como trace ID, operation ID, método
 * HTTP, rota normalizada e instante de início.
 */
export interface RequestContext {
  /** Identificador de rastreamento propagado ao longo da requisição. */
  traceId: string;
  /** Identificador da operação (operationId) sendo executada. */
  operationId: string;
  /** Método HTTP da requisição (ex.: `GET`, `POST`). */
  method: string;
  /** Rota normalizada (com placeholders de parâmetros), útil para métricas. */
  normalizedRoute: string;
  /** Instante em que o processamento da requisição foi iniciado. */
  startedAt: Date;
}
