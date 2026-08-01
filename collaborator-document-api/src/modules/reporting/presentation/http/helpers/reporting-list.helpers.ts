import type {Response} from "express";
import type {Result} from "neverthrow";
import {Returns} from "@tsed/schema";

import type {
  CursorCodec,
  CursorContext
} from "../../../../../shared/application/pagination/cursor-codec.js";
import type {ProblemDetailsMapper} from "../../../../../shared/presentation/http/errors/problem-details.mapper.js";
import {getRequestTraceId} from "../../../../../shared/presentation/http/middlewares/request-id.middleware.js";
import {ProblemDetails} from "../../../../../shared/presentation/http/schemas/problem-details.js";
import type {ReportingFailure} from "../../../application/reporting.failure.js";
import type {KeysetPageQueryDto} from "../dtos/keyset-page.query.dto.js";

export function parseLimit(rawLimit: string | undefined, defaultLimit = 20): number {
  return rawLimit === undefined || rawLimit === "" ? defaultLimit : Number(rawLimit);
}

export function isInvalidLimit(limit: number): boolean {
  return !Number.isInteger(limit) || limit < 1 || limit > 100;
}

export function invalidCursorOrLimit(field: "cursor" | "limit", message: string): ReportingFailure {
  return {
    code: "INVALID_QUERY_PARAMETER",
    message,
    errors: [
      {
        field,
        code: field === "cursor" ? "INVALID_CURSOR" : "INVALID_LIMIT",
        message: `The ${field} query parameter is invalid.`
      }
    ]
  };
}

export type ResolvedListCursor<T> =
  | {ok: true; limit: number; context: CursorContext; after?: T}
  | {ok: false; failure: ReportingFailure};

/** Valida limit/cursor e decodifica a posição keyset para listagens de reporting. */
export function resolveListCursor<T>(options: {
  rawLimit: string | undefined;
  cursor: string | undefined;
  codec: CursorCodec;
  contextBase: Omit<CursorContext, "limit">;
  decodePosition: (value: string) => T | undefined;
  invalidMessage: string;
}): ResolvedListCursor<T> {
  const limit = parseLimit(options.rawLimit);
  const invalid = (field: "cursor" | "limit") =>
    invalidCursorOrLimit(field, options.invalidMessage);
  if (isInvalidLimit(limit)) {
    return {ok: false, failure: invalid("limit")};
  }
  if (options.cursor?.length === 0) {
    return {ok: false, failure: invalid("cursor")};
  }

  const context: CursorContext = {...options.contextBase, limit};
  const decoded = options.cursor ? options.codec.decode(options.cursor, context) : undefined;
  if (decoded?.isErr()) {
    return {ok: false, failure: invalid("cursor")};
  }
  const after = decoded?.isOk() ? options.decodePosition(decoded.value.position.id) : undefined;
  if (decoded?.isOk() && !after) {
    return {ok: false, failure: invalid("cursor")};
  }
  return after ? {ok: true, limit, context, after} : {ok: true, limit, context};
}

export function writeReportingProblem(
  res: Response,
  problems: ProblemDetailsMapper,
  failure: ReportingFailure,
  traceId: string,
  fallbackInstance: string
): void {
  const {problem, retryAfter} = problems.fromFailure(failure, {
    instance: res.req?.path ?? fallbackInstance,
    traceId
  });
  res.status(problem.status).type("application/problem+json");
  if (retryAfter) res.setHeader("Retry-After", String(retryAfter));
  res.json(problem);
}

export function collectionHref(route: string, limit: number, cursor?: string): string {
  const query = new URLSearchParams({limit: String(limit)});
  if (cursor) query.set("cursor", cursor);
  return `${route}?${query.toString()}`;
}

/** Respostas HTTP comuns das listagens keyset de reporting. */
export function ReportingListErrorResponses(): MethodDecorator {
  return (target, propertyKey, descriptor) => {
    const apply = (decorator: MethodDecorator) => {
      decorator(target, propertyKey, descriptor!);
    };
    apply(Returns(304).Description("Representação inalterada.") as MethodDecorator);
    apply(Returns(400, ProblemDetails).ContentType("application/problem+json") as MethodDecorator);
    apply(
      Returns(429, ProblemDetails)
        .ContentType("application/problem+json")
        .Header("Retry-After", {
          $ref: "#/components/headers/RetryAfter"
        } as never) as MethodDecorator
    );
    apply(Returns(500, ProblemDetails).ContentType("application/problem+json") as MethodDecorator);
    apply(Returns(503, ProblemDetails).ContentType("application/problem+json") as MethodDecorator);
    return descriptor;
  };
}

type RateLimiter = {handle(req: unknown, res: Response): Promise<boolean> | boolean};

/** Fluxo compartilhado: rate-limit → cursor → execute → write/problem. */
export async function runReportingKeysetList<TAfter, TPage>(options: {
  res: Response;
  operationId: string;
  route: string;
  query: KeysetPageQueryDto;
  problems: ProblemDetailsMapper;
  rateLimiter: RateLimiter;
  codec: CursorCodec;
  contextBase: Omit<CursorContext, "limit">;
  decodePosition: (value: string) => TAfter | undefined;
  invalidMessage: string;
  execute: (input: {
    cursor?: string;
    limit: number;
    after?: TAfter;
  }) => Promise<Result<TPage, ReportingFailure>>;
  writePage: (
    page: TPage,
    limit: number,
    cursor: string | undefined,
    context: CursorContext
  ) => void;
}): Promise<void> {
  const {res, query} = options;
  const traceId = getRequestTraceId(res.req!);
  if (!(await options.rateLimiter.handle(res.req!, res))) return;

  const {cursor, limit: rawLimit} = query;
  const resolved = resolveListCursor({
    rawLimit,
    cursor,
    codec: options.codec,
    contextBase: options.contextBase,
    decodePosition: options.decodePosition,
    invalidMessage: options.invalidMessage
  });
  if (!resolved.ok) {
    return writeReportingProblem(res, options.problems, resolved.failure, traceId, options.route);
  }

  const {limit, context, after} = resolved;
  const result = await options.execute({
    ...(cursor !== undefined ? {cursor} : {}),
    limit,
    ...(after ? {after} : {})
  });
  result.match(
    (page) => options.writePage(page, limit, cursor, context),
    (failure) => writeReportingProblem(res, options.problems, failure, traceId, options.route)
  );
}
