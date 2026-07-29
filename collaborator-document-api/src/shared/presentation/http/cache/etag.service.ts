import {createHash} from "node:crypto";

const TRACE_KEYS = new Set([
  "traceId",
  "traceid",
  "requestId",
  "requestid",
  "generatedAt",
  "headers"
]);

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }
  const keys = Object.keys(value as Record<string, unknown>)
    .filter((k) => !TRACE_KEYS.has(k))
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize((value as Record<string, unknown>)[k])}`).join(",")}}`;
}

export class EtagService {
  compute(payload: unknown): string {
    const hash = createHash("sha256").update(canonicalize(payload)).digest("hex");
    return `W/"sha256:${hash}"`;
  }

  matches(serverTag: string, clientTag: string): boolean {
    return serverTag === clientTag;
  }
}
