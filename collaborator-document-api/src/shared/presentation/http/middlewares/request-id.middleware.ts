import {randomUUID} from "node:crypto";
import type {Request, Response, NextFunction} from "express";

const TRACE_HEADER = "x-request-id";

/**
 * Middleware Express que assegura que toda requisição tenha
 * um trace ID (`X-Request-Id`). Reutiliza o header de
 * entrada se presente, ou gera um UUID.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const existing = req.headers[TRACE_HEADER] as string | undefined;
  const traceId = existing?.trim() || randomUUID();
  req.headers[TRACE_HEADER] = traceId;
  res.setHeader("X-Request-Id", traceId);
  next();
}

/**
 * Extrai o trace ID de uma requisição (header
 * `X-Request-Id`), ou gera um UUID se ausente.
 *
 * @param req - Objeto de requisição com `headers`.
 * @returns Trace ID encontrado ou gerado.
 */
export function getRequestTraceId(req: {
  headers: Record<string, string | string[] | undefined>;
}): string {
  return (req.headers[TRACE_HEADER] as string) ?? randomUUID();
}
