/**
 * OpenTelemetry preload entry — must load via `--import` before application code.
 *
 * Starts only when `OTEL_ENABLED=true`. Otherwise this module is a no-op.
 */
import {startOtelSdk} from "./observability/otel-sdk.js";

startOtelSdk();

export {isOtelStarted, shutdownOtel, startOtelSdk} from "./observability/otel-sdk.js";
export {
  DEFAULT_OTEL_ENDPOINT,
  DEFAULT_OTEL_SERVICE_NAME,
  shouldEnableOtel
} from "./observability/otel-config.js";
