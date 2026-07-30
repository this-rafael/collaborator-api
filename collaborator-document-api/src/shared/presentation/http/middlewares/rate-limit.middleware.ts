import type {Clock} from "../../../application/ports/clock.js";
import {ProblemDetailsMapper} from "../errors/problem-details.mapper.js";
import {getRequestTraceId} from "./request-id.middleware.js";

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

type RateLimitRequest = {
  ip?: string;
  path: string;
  headers: Record<string, string | string[] | undefined>;
};

type RateLimitResponse = {
  status(code: number): unknown;
  type(value: string): unknown;
  setHeader(name: string, value: string | number): unknown;
  json(payload: unknown): unknown;
};

/**
 * Middleware de rate limit baseado em janela fixa em
 * memória.
 *
 * Limita requisições por IP + operationId dentro de uma
 * janela configurável. Quando o limite é excedido,
 * retorna 429 com Problem Details e cabeçalho
 * `Retry-After`.
 *
 * @remarks A store é volátil (em memória); não persiste
 *   entre reinicializações.
 */
export class RateLimitMiddleware {
  private readonly store = new Map<string, RateLimitEntry>();
  private readonly mapper = new ProblemDetailsMapper();

  constructor(
    private readonly config: {
      limit: number;
      windowMs: number;
      operationId?: string;
      clock?: Clock;
    }
  ) {}

  reset(): void {
    this.store.clear();
  }

  async handle(req: RateLimitRequest, res: RateLimitResponse): Promise<boolean> {
    const now = this.config.clock?.now() ?? new Date();
    const nowMs = now.getTime();
    const key = `${req.ip ?? "unknown"}:${this.config.operationId ?? "discoverApi"}`;
    const entry = this.store.get(key);

    if (!entry || nowMs - entry.windowStart >= this.config.windowMs) {
      this.store.set(key, {count: 1, windowStart: nowMs});
      return true;
    }

    entry.count += 1;
    if (entry.count > this.config.limit) {
      const remaining = this.config.windowMs - (nowMs - entry.windowStart);
      const retryAfter = Math.ceil(remaining / 1000);

      const traceId = getRequestTraceId(req);
      const {problem} = this.mapper.fromFailure(
        {code: "RATE_LIMIT_EXCEEDED"},
        {instance: "/api/v1", traceId}
      );

      res.status(429);
      res.type("application/problem+json");
      res.setHeader("Retry-After", String(retryAfter));
      res.json(problem);
      return false;
    }

    return true;
  }
}
