import {afterEach, describe, expect, it, vi} from "vitest";

import {
  DEFAULT_OTEL_ENDPOINT,
  DEFAULT_OTEL_SERVICE_NAME,
  isValidOtlpEndpoint,
  resolveOtelRuntimeConfig,
  shouldEnableOtel
} from "../../src/observability/otel-config.js";

const start = vi.fn();
const shutdown = vi.fn().mockResolvedValue(undefined);

vi.mock("@opentelemetry/sdk-node", () => ({
  NodeSDK: class {
    start = start;
    shutdown = shutdown;
  }
}));

vi.mock("@opentelemetry/auto-instrumentations-node", () => ({
  getNodeAutoInstrumentations: () => []
}));

vi.mock("@opentelemetry/exporter-trace-otlp-http", () => ({
  OTLPTraceExporter: class {}
}));

vi.mock("@opentelemetry/exporter-metrics-otlp-http", () => ({
  OTLPMetricExporter: class {}
}));

vi.mock("@opentelemetry/sdk-metrics", () => ({
  PeriodicExportingMetricReader: class {}
}));

vi.mock("@opentelemetry/resources", () => ({
  resourceFromAttributes: () => ({})
}));

const {isOtelStarted, shutdownOtel, startOtelSdk} =
  await import("../../src/observability/otel-sdk.js");

describe("OpenTelemetry config", () => {
  it("treats only the literal true as enabled", () => {
    expect(shouldEnableOtel({})).toBe(false);
    expect(shouldEnableOtel({OTEL_ENABLED: "false"})).toBe(false);
    expect(shouldEnableOtel({OTEL_ENABLED: "TRUE"})).toBe(false);
    expect(shouldEnableOtel({OTEL_ENABLED: "true"})).toBe(true);
  });

  it("validates OTLP endpoints", () => {
    expect(isValidOtlpEndpoint("http://localhost:4318")).toBe(true);
    expect(isValidOtlpEndpoint("https://otel.example.com")).toBe(true);
    expect(isValidOtlpEndpoint("ftp://localhost:4318")).toBe(false);
    expect(isValidOtlpEndpoint("not-a-url")).toBe(false);
  });

  it("resolves defaults when disabled", () => {
    expect(resolveOtelRuntimeConfig({})).toEqual({
      ok: true,
      value: {
        enabled: false,
        serviceName: DEFAULT_OTEL_SERVICE_NAME,
        exporterOtlpEndpoint: DEFAULT_OTEL_ENDPOINT
      }
    });
  });

  it("rejects invalid endpoints only when enabled", () => {
    expect(
      resolveOtelRuntimeConfig({
        OTEL_ENABLED: "true",
        OTEL_EXPORTER_OTLP_ENDPOINT: "bad"
      })
    ).toEqual({
      ok: false,
      issues: ["OTEL_EXPORTER_OTLP_ENDPOINT must be a valid http(s) URL"]
    });
  });
});

describe("OpenTelemetry SDK lifecycle", () => {
  afterEach(async () => {
    await shutdownOtel();
    start.mockClear();
    shutdown.mockClear();
    delete process.env.OTEL_ENABLED;
    delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    delete process.env.OTEL_SERVICE_NAME;
  });

  it("is a no-op when OTEL_ENABLED is not true", () => {
    process.env.OTEL_ENABLED = "false";
    startOtelSdk();
    expect(isOtelStarted()).toBe(false);
    expect(start).not.toHaveBeenCalled();
  });

  it("starts when OTEL_ENABLED=true and shuts down cleanly", async () => {
    process.env.OTEL_ENABLED = "true";
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = "http://127.0.0.1:4318";
    process.env.OTEL_SERVICE_NAME = "unit-test-api";

    startOtelSdk();
    expect(isOtelStarted()).toBe(true);
    expect(start).toHaveBeenCalledOnce();

    await shutdownOtel();
    expect(isOtelStarted()).toBe(false);
    expect(shutdown).toHaveBeenCalledOnce();
  });

  it("does not start when enabled with an invalid endpoint", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    process.env.OTEL_ENABLED = "true";
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = "bad";

    startOtelSdk();
    expect(isOtelStarted()).toBe(false);
    expect(start).not.toHaveBeenCalled();
    error.mockRestore();
  });
});
