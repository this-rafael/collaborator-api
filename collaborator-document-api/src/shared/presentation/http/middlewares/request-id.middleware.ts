import {randomUUID} from "node:crypto";
import type {Request, Response, NextFunction} from "express";

const TRACE_HEADER = "x-request-id";

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const existing = req.headers[TRACE_HEADER] as string | undefined;
  const traceId = existing?.trim() || randomUUID();
  req.headers[TRACE_HEADER] = traceId;
  res.setHeader("X-Request-Id", traceId);
  next();
}

export function getRequestTraceId(req: {
  headers: Record<string, string | string[] | undefined>;
}): string {
  return (req.headers[TRACE_HEADER] as string) ?? randomUUID();
}
