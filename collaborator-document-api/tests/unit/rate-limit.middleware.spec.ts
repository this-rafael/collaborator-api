import {describe, expect, it} from "vitest";

import {RateLimitMiddleware} from "../../src/shared/presentation/http/middlewares/rate-limit.middleware.js";
import {ManualClock, fixedTraceId} from "../helpers/discovery-runtime.js";
import {problemDetailsRateLimitFixture} from "../helpers/discovery-fixtures.js";

const baseRequest = (ip = "203.0.113.10") => ({
  ip,
  method: "GET",
  path: "/api/v1",
  headers: {"x-request-id": fixedTraceId, "x-trace-id": fixedTraceId},
  query: {} as Record<string, string>
});

const buildResponse = () => {
  const headers: Record<string, string> = {};
  const body: {payload?: unknown; written: boolean} = {written: false};
  const res = {
    statusCode: 200,
    setHeader(name: string, value: string | number) {
      headers[name.toLowerCase()] = String(value);
      return this;
    },
    getHeader(name: string) {
      return headers[name.toLowerCase()];
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    type(value: string) {
      headers["content-type"] = value;
      return this;
    },
    json(payload: unknown) {
      body.payload = payload;
      body.written = true;
      return this;
    },
    end() {
      body.written = true;
      return this;
    }
  };
  return {res, headers, body};
};

describe("Rate limit middleware", () => {
  it("allows requests up to the configured limit per IP + operation within the window", async () => {
    const clock = new ManualClock(new Date("2026-07-28T12:00:00.000Z"));
    const middleware = new RateLimitMiddleware({limit: 3, windowMs: 60_000, clock});

    for (let i = 0; i < 3; i += 1) {
      const {res, headers, body} = buildResponse();
      const allowed = await middleware.handle(baseRequest("203.0.113.1"), res);
      expect(allowed).toBe(true);
      expect(body.written).toBe(false);
      expect(headers["retry-after"]).toBeUndefined();
    }
  });

  it("rejects the request that exceeds the limit with 429, Retry-After and Problem Details", async () => {
    const clock = new ManualClock(new Date("2026-07-28T12:00:00.000Z"));
    const middleware = new RateLimitMiddleware({limit: 2, windowMs: 60_000, clock});

    await middleware.handle(baseRequest("203.0.113.2"), buildResponse().res);
    await middleware.handle(baseRequest("203.0.113.2"), buildResponse().res);

    const {res, headers, body} = buildResponse();
    const allowed = await middleware.handle(baseRequest("203.0.113.2"), res);
    expect(allowed).toBe(false);
    expect(res.statusCode).toBe(429);
    expect(headers["content-type"]).toContain("application/problem+json");
    expect(headers["retry-after"]).toBeDefined();
    const retryAfter = Number.parseInt(headers["retry-after"] as string, 10);
    expect(retryAfter).toBeGreaterThanOrEqual(1);

    const payload = body.payload as ReturnType<typeof problemDetailsRateLimitFixture>;
    expect(payload.status).toBe(429);
    expect(payload.code).toBe("RATE_LIMIT_EXCEEDED");
    expect(payload.instance).toBe("/api/v1");
    expect(typeof payload.traceId).toBe("string");
    expect(payload.traceId.length).toBeGreaterThan(0);
  });

  it("isolates counters per IP + operation", async () => {
    const clock = new ManualClock(new Date("2026-07-28T12:00:00.000Z"));
    const middleware = new RateLimitMiddleware({limit: 1, windowMs: 60_000, clock});

    const first = await middleware.handle(baseRequest("203.0.113.3"), buildResponse().res);
    const second = await middleware.handle(baseRequest("203.0.113.4"), buildResponse().res);

    expect(first).toBe(true);
    expect(second).toBe(true);
  });

  it("expires the window after windowMs and resets counters", async () => {
    const clock = new ManualClock(new Date("2026-07-28T12:00:00.000Z"));
    const middleware = new RateLimitMiddleware({limit: 1, windowMs: 60_000, clock});

    await middleware.handle(baseRequest("203.0.113.5"), buildResponse().res);
    const rejected = await middleware.handle(baseRequest("203.0.113.5"), buildResponse().res);
    expect(rejected).toBe(false);

    clock.advance(60_001);

    const recovered = await middleware.handle(baseRequest("203.0.113.5"), buildResponse().res);
    expect(recovered).toBe(true);
  });

  it("computes Retry-After using the remaining time in the current window", async () => {
    const clock = new ManualClock(new Date("2026-07-28T12:00:00.000Z"));
    const middleware = new RateLimitMiddleware({limit: 1, windowMs: 60_000, clock});

    await middleware.handle(baseRequest("203.0.113.6"), buildResponse().res);
    clock.advance(20_000);

    const {res, headers} = buildResponse();
    await middleware.handle(baseRequest("203.0.113.6"), res);
    const retryAfter = Number.parseInt(headers["retry-after"] as string, 10);
    expect(retryAfter).toBeGreaterThanOrEqual(40);
    expect(retryAfter).toBeLessThanOrEqual(41);
  });

  it("keys the counter with unknown when the request has no ip", async () => {
    const clock = new ManualClock(new Date("2026-07-28T12:00:00.000Z"));
    const middleware = new RateLimitMiddleware({limit: 1, windowMs: 60_000, clock});
    const request = {
      method: "GET",
      path: "/api/v1",
      headers: {"x-request-id": fixedTraceId},
      query: {} as Record<string, string>
    };

    expect(await middleware.handle(request, buildResponse().res)).toBe(true);
    expect(await middleware.handle(request, buildResponse().res)).toBe(false);
  });
});
