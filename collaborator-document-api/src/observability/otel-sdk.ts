/**
 * OpenTelemetry Node SDK lifecycle (start/shutdown).
 *
 * The `--import` entrypoint `src/instrumentation.ts` calls {@link startOtelSdk}.
 * Application shutdown calls {@link shutdownOtel} without re-entering start.
 */
import {diag, DiagConsoleLogger, DiagLogLevel} from "@opentelemetry/api";
import {getNodeAutoInstrumentations} from "@opentelemetry/auto-instrumentations-node";
import {OTLPMetricExporter} from "@opentelemetry/exporter-metrics-otlp-http";
import {OTLPTraceExporter} from "@opentelemetry/exporter-trace-otlp-http";
import {resourceFromAttributes} from "@opentelemetry/resources";
import {PeriodicExportingMetricReader} from "@opentelemetry/sdk-metrics";
import {NodeSDK} from "@opentelemetry/sdk-node";
import {
  ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION
} from "@opentelemetry/semantic-conventions";

import {resolveOtelRuntimeConfig, shouldEnableOtel} from "./otel-config.js";

let sdk: NodeSDK | undefined;

/**
 * Starts the OpenTelemetry SDK when `OTEL_ENABLED=true`.
 *
 * Safe to call more than once: subsequent calls are no-ops while running.
 */
export function startOtelSdk(): void {
  if (sdk || !shouldEnableOtel(process.env)) {
    return;
  }

  const config = resolveOtelRuntimeConfig(process.env);
  if (!config.ok) {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR);
    diag.error(`OpenTelemetry disabled due to invalid config: ${config.issues.join("; ")}`);
    return;
  }

  const endpoint = config.value.exporterOtlpEndpoint;
  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: config.value.serviceName,
    [ATTR_SERVICE_VERSION]: process.env.npm_package_version ?? "0.1.0",
    [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: process.env.NODE_ENV ?? "development"
  });

  sdk = new NodeSDK({
    resource,
    traceExporter: new OTLPTraceExporter({url: `${endpoint}/v1/traces`}),
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({url: `${endpoint}/v1/metrics`}),
      exportIntervalMillis: 10_000
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        "@opentelemetry/instrumentation-fs": {enabled: false}
      })
    ]
  });

  sdk.start();
}

/**
 * Shuts down the OpenTelemetry SDK if it was started.
 *
 * @returns Resolves when flush/shutdown complete (or immediately if disabled).
 */
export async function shutdownOtel(): Promise<void> {
  if (!sdk) return;
  const active = sdk;
  sdk = undefined;
  await active.shutdown();
}

/**
 * @returns Whether the SDK was started in this process.
 */
export function isOtelStarted(): boolean {
  return sdk !== undefined;
}
