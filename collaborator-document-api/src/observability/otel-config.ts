/**
 * Shared OpenTelemetry environment parsing (used by `loadEnv` and the
 * `--import` instrumentation entrypoint).
 */

export const DEFAULT_OTEL_SERVICE_NAME = "collaborator-document-api";
export const DEFAULT_OTEL_ENDPOINT = "http://localhost:14318";

/**
 * Runtime OpenTelemetry settings after validation.
 */
export type OtelConfig = Readonly<{
  /** Whether the SDK should export telemetry. */
  enabled: boolean;
  /** Resource `service.name`. */
  serviceName: string;
  /** Base OTLP HTTP endpoint (without `/v1/traces` or `/v1/metrics`). */
  exporterOtlpEndpoint: string;
}>;

/**
 * @param source - Process environment.
 * @returns `true` when `OTEL_ENABLED` is exactly `true` (trimmed).
 */
export function shouldEnableOtel(source: NodeJS.ProcessEnv = process.env): boolean {
  return source.OTEL_ENABLED?.trim() === "true";
}

function optional(source: NodeJS.ProcessEnv, name: string, defaultValue: string): string {
  const value = source[name]?.trim();
  return value || defaultValue;
}

/**
 * Validates an OTLP base URL (http/https with host).
 *
 * @param endpoint - Candidate endpoint string.
 * @returns `true` when the URL is usable as an OTLP base.
 */
export function isValidOtlpEndpoint(endpoint: string): boolean {
  try {
    const parsed = new URL(endpoint);
    return (
      (parsed.protocol === "http:" || parsed.protocol === "https:") && Boolean(parsed.hostname)
    );
  } catch {
    return false;
  }
}

/**
 * Resolves OTel config from env without requiring `OTEL_ENABLED=true`.
 * When enabled, validates the exporter endpoint.
 *
 * @param source - Process environment.
 * @returns Ok config or validation issues.
 */
export function resolveOtelRuntimeConfig(
  source: NodeJS.ProcessEnv = process.env
): {ok: true; value: OtelConfig} | {ok: false; issues: string[]} {
  const issues: string[] = [];
  const enabled = shouldEnableOtel(source);
  const serviceName = optional(source, "OTEL_SERVICE_NAME", DEFAULT_OTEL_SERVICE_NAME);
  const exporterOtlpEndpoint = optional(
    source,
    "OTEL_EXPORTER_OTLP_ENDPOINT",
    DEFAULT_OTEL_ENDPOINT
  );

  if (enabled && !isValidOtlpEndpoint(exporterOtlpEndpoint)) {
    issues.push("OTEL_EXPORTER_OTLP_ENDPOINT must be a valid http(s) URL");
  }

  if (issues.length > 0) {
    return {ok: false, issues};
  }

  return {
    ok: true,
    value: {
      enabled,
      serviceName,
      exporterOtlpEndpoint: exporterOtlpEndpoint.replace(/\/$/, "")
    }
  };
}

/**
 * Parses OTel settings for `AppEnv`, appending issues when enabled config is invalid.
 *
 * @param source - Process environment.
 * @param issues - Mutable validation issue list.
 * @returns OTel config (defaults when disabled).
 */
export function parseOtelEnv(source: NodeJS.ProcessEnv, issues: string[]): OtelConfig {
  const resolved = resolveOtelRuntimeConfig(source);
  if (!resolved.ok) {
    issues.push(...resolved.issues);
    return {
      enabled: shouldEnableOtel(source),
      serviceName: optional(source, "OTEL_SERVICE_NAME", DEFAULT_OTEL_SERVICE_NAME),
      exporterOtlpEndpoint: optional(
        source,
        "OTEL_EXPORTER_OTLP_ENDPOINT",
        DEFAULT_OTEL_ENDPOINT
      ).replace(/\/$/, "")
    };
  }
  return resolved.value;
}
