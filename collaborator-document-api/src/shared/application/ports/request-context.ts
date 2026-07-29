export interface RequestContext {
  traceId: string;
  operationId: string;
  method: string;
  normalizedRoute: string;
  startedAt: Date;
}
