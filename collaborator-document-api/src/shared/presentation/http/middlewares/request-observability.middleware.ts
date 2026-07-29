import type {Request, Response, NextFunction} from "express";
import {$log} from "@tsed/logger";

const CPF_PATTERN = /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g;
const EMAIL_PATTERN = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

export function maskSensitive(value: string): string {
  return value.replace(CPF_PATTERN, "***").replace(EMAIL_PATTERN, "***@***");
}

export function requestObservabilityMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const normalizedRoute = maskSensitive(req.path);
  const startedAt = process.hrtime.bigint();

  res.setHeader("X-Observability-Route", normalizedRoute);
  res.once("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const operationId =
      normalizedRoute === "/api/v1" && req.method === "GET" ? "discoverApi" : "unknown";
    $log.info({
      event: "HTTP_REQUEST",
      method: req.method,
      route: normalizedRoute,
      status: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
      operationId,
      result: res.statusCode >= 500 ? "failure" : res.statusCode >= 400 ? "rejected" : "success"
    });
  });

  next();
}
