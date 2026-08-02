import {afterEach, describe, expect, it, vi} from "vitest";
import {TraceFlags, type Span} from "@opentelemetry/api";
import {trace} from "@opentelemetry/api";
import type {Request, Response} from "express";

import {requestObservabilityMiddleware} from "../../src/shared/presentation/http/middlewares/request-observability.middleware.js";

vi.mock("@tsed/logger", () => ({
  $log: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

import {$log} from "@tsed/logger";

function createSpan(traceId: string, spanId: string): Span {
  return {
    spanContext: () => ({
      traceId,
      spanId,
      traceFlags: TraceFlags.SAMPLED,
      isRemote: false
    }),
    setAttribute: vi.fn(),
    setAttributes: vi.fn(),
    addEvent: vi.fn(),
    setStatus: vi.fn(),
    updateName: vi.fn(),
    end: vi.fn(),
    isRecording: () => true,
    recordException: vi.fn()
  } as unknown as Span;
}

describe("requestObservabilityMiddleware OpenTelemetry correlation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("logs requestId without otel fields when no span is active", () => {
    vi.spyOn(trace, "getActiveSpan").mockReturnValue(undefined);

    const req = {
      method: "GET",
      path: "/api/v1",
      headers: {"x-request-id": "req-no-span"}
    } as unknown as Request;
    const listeners = new Map<string, () => void>();
    const res = {
      statusCode: 200,
      setHeader: vi.fn(),
      once: (event: string, handler: () => void) => {
        listeners.set(event, handler);
      }
    } as unknown as Response;
    const next = vi.fn();

    requestObservabilityMiddleware(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    listeners.get("finish")?.();

    expect($log.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "HTTP_REQUEST",
        requestId: "req-no-span"
      })
    );
    const payload = vi.mocked($log.info).mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("otelTraceId");
    expect(payload).not.toHaveProperty("otelSpanId");
  });

  it("attaches request.id to the active span and logs otel ids", () => {
    const traceId = "0af7651916cd43dd8448eb211c80319c";
    const spanId = "b7ad6b7169203331";
    const span = createSpan(traceId, spanId);
    vi.spyOn(trace, "getActiveSpan").mockReturnValue(span);

    const req = {
      method: "GET",
      path: "/api/v1",
      headers: {"x-request-id": "req-with-span"}
    } as unknown as Request;
    const listeners = new Map<string, () => void>();
    const res = {
      statusCode: 200,
      setHeader: vi.fn(),
      once: (event: string, handler: () => void) => {
        listeners.set(event, handler);
      }
    } as unknown as Response;
    const next = vi.fn();

    requestObservabilityMiddleware(req, res, next);

    expect(span.setAttribute).toHaveBeenCalledWith("request.id", "req-with-span");
    listeners.get("finish")?.();

    expect($log.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "HTTP_REQUEST",
        requestId: "req-with-span",
        otelTraceId: traceId,
        otelSpanId: spanId
      })
    );
  });
});
