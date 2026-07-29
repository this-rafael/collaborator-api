import {randomUUID} from "node:crypto";

import type {Response} from "express";

import {ProblemDetailsMapper} from "../errors/problem-details.mapper.js";

export class GlobalErrorFilter {
  private mapper = new ProblemDetailsMapper();

  catch(error: unknown, ctx: {response: Response}): void {
    const res = ctx.response;
    const traceId = randomUUID();

    const {problem} = this.mapper.fromFailure(
      {code: "INTERNAL_SERVER_ERROR"},
      {instance: normalizeInstance(res.req?.path), traceId}
    );
    res.status(500).type("application/problem+json").json(problem);
  }
}

function normalizeInstance(path: string | undefined): string {
  return path?.split("?")[0] || "/unknown";
}

export function globalErrorMiddleware(
  error: unknown,
  req: unknown,
  res: Response,
  _next: unknown
): void {
  new GlobalErrorFilter().catch(error, {response: res});
  void req;
}
