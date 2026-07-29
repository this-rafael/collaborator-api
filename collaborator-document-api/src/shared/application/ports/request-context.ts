/**
 * Porta que representa o contexto de uma requisição HTTP.
 *
 * Carrega metadados como trace ID, operation ID, método
 * HTTP, rota normalizada e instante de início.
 */
export interface RequestContext {
  traceId: string;
  operationId: string;
  method: string;
  normalizedRoute: string;
  startedAt: Date;
}
