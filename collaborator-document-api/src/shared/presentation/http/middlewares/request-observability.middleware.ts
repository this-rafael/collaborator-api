import type {Request, Response, NextFunction} from "express";
import {isSpanContextValid, trace} from "@opentelemetry/api";
import {$log} from "@tsed/logger";

import {getRequestTraceId} from "./request-id.middleware.js";

const CPF_PATTERN = /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g;

/**
 * Remove dados sensíveis (CPF, email) de uma string,
 * substituindo-os por `***`.
 *
 * @param value - String original.
 * @returns String com dados mascarados.
 */
export function maskSensitive(value: string): string {
  return maskEmails(value.replace(CPF_PATTERN, "***"));
}

/** Mascara e-mails sem regex com backtracking. */
function maskEmails(value: string): string {
  let result = "";
  let index = 0;
  while (index < value.length) {
    const at = value.indexOf("@", index);
    if (at < 0) {
      result += value.slice(index);
      break;
    }
    let start = at;
    while (start > index && value[start - 1] !== "/" && value[start - 1] !== " ") {
      start -= 1;
    }
    let end = at + 1;
    while (end < value.length && value[end] !== "/" && value[end] !== " ") {
      end += 1;
    }
    if (start < at && end > at + 1) {
      result += value.slice(index, start) + "***@***";
      index = end;
      continue;
    }
    result += value.slice(index, at + 1);
    index = at + 1;
  }
  return result;
}

/**
 * Middleware Express de observabilidade.
 *
 * Adiciona o header `X-Observability-Route` (com dados
 * sensíveis mascarados) e loga métricas de duração,
 * status e resultado ao finalizar a resposta. Quando há
 * span OTel ativo, correlaciona `request.id` e inclui
 * `otelTraceId` / `otelSpanId` no log estruturado.
 */
export function requestObservabilityMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const normalizedRoute = maskSensitive(req.path);
  const startedAt = process.hrtime.bigint();
  const requestId = getRequestTraceId(req);
  const span = trace.getActiveSpan();
  let otelTraceId: string | undefined;
  let otelSpanId: string | undefined;

  if (span) {
    const context = span.spanContext();
    if (isSpanContextValid(context)) {
      span.setAttribute("request.id", requestId);
      otelTraceId = context.traceId;
      otelSpanId = context.spanId;
    }
  }

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
      result: getResultLabel(res.statusCode),
      requestId,
      ...(otelTraceId ? {otelTraceId, otelSpanId} : {})
    });
  });

  next();
}

function getResultLabel(statusCode: number): string {
  if (statusCode >= 500) return "failure";
  if (statusCode >= 400) return "rejected";
  return "success";
}
