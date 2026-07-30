import {randomUUID} from "node:crypto";

import type {Response} from "express";

import {ProblemDetailsMapper} from "../errors/problem-details.mapper.js";

/**
 * Filtro global de erros não capturados.
 *
 * Captura exceções não tratadas e retorna uma resposta
 * Problem Details 500 com trace ID gerado no momento.
 */
export class GlobalErrorFilter {
  private readonly mapper = new ProblemDetailsMapper();

  catch(error: unknown, ctx: {response: Response}): void {
    const res = ctx.response;
    const traceId = randomUUID();
    const code = isMalformedJsonError(error) ? "MALFORMED_JSON" : "INTERNAL_SERVER_ERROR";

    const {problem} = this.mapper.fromFailure(
      {code},
      {instance: normalizeInstance(res.req?.path), traceId}
    );
    res.status(problem.status).type("application/problem+json").json(problem);
  }
}

function isMalformedJsonError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    error.type === "entity.parse.failed"
  );
}

function normalizeInstance(path: string | undefined): string {
  return path?.split("?")[0] || "/unknown";
}

/**
 * Middleware Express que delega o tratamento de erros não
 * capturados ao `GlobalErrorFilter`.
 */
export function globalErrorMiddleware(
  error: unknown,
  _req: unknown,
  res: Response,
  _next: unknown
): void {
  new GlobalErrorFilter().catch(error, {response: res});
}
