import {createHash} from "node:crypto";
import {describe, expect, it} from "vitest";

import {EtagService} from "../../src/shared/presentation/http/cache/etag.service.js";
import {apiRootFixture, apiRootAltVersionFixture} from "../helpers/discovery-fixtures.js";

const canonicalize = (value: unknown): string => {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize((value as Record<string, unknown>)[k])}`).join(",")}}`;
};

const expectedEtagFor = (payload: unknown): string => {
  const hash = createHash("sha256").update(canonicalize(payload)).digest("hex");
  return `W/"sha256:${hash}"`;
};

describe("ETag service", () => {
  it('emits a weak ETag in the W/"sha256:<64 hex>" format', () => {
    const service = new EtagService();
    const etag = service.compute(apiRootFixture);
    expect(etag).toMatch(/^W\/"sha256:[a-f0-9]{64}"$/);
  });

  it("produces the SHA-256 hash over the canonical JSON of the representation", () => {
    const service = new EtagService();
    const etag = service.compute(apiRootFixture);
    expect(etag).toBe(expectedEtagFor(apiRootFixture));
  });

  it("is stable across repeated invocations for the same payload", () => {
    const service = new EtagService();
    const first = service.compute(apiRootFixture);
    const second = service.compute(apiRootFixture);
    expect(first).toBe(second);
  });

  it("changes the ETag when the semantic payload changes", () => {
    const service = new EtagService();
    const original = service.compute(apiRootFixture);
    const updated = service.compute(apiRootAltVersionFixture);
    expect(original).not.toBe(updated);
  });

  it("ignores trace identifiers, request headers and timestamps present alongside the payload", () => {
    const service = new EtagService();
    const withNoise = {
      ...apiRootFixture,
      traceId: "01J3Y2QHB8FV4RGY7Y1QXNT2D4",
      generatedAt: new Date("2026-07-28T12:00:00.000Z"),
      requestId: "req-123",
      headers: {"x-forwarded-for": "203.0.113.5"}
    };
    expect(service.compute(withNoise)).toBe(service.compute(apiRootFixture));
  });

  it("matches ETag equality only on identical weak tags, regardless of W/ prefix case", () => {
    const service = new EtagService();
    const tag = service.compute(apiRootFixture);
    expect(service.matches(tag, tag)).toBe(true);
    expect(service.matches(tag, `${tag.toLowerCase()}`)).toBe(false);
  });

  it("returns false when the client provides a different ETag", () => {
    const service = new EtagService();
    const tag = service.compute(apiRootFixture);
    expect(service.matches(tag, `W/"sha256:${"0".repeat(64)}"`)).toBe(false);
  });
});
