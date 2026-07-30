import {describe, expect, it} from "vitest";

import {getRequestTraceId} from "../../src/shared/presentation/http/middlewares/request-id.middleware.js";

describe("getRequestTraceId", () => {
  it("returns the X-Request-Id header when present", () => {
    expect(getRequestTraceId({headers: {"x-request-id": "trace-from-client"}})).toBe(
      "trace-from-client"
    );
  });

  it("generates a UUID when the header is absent", () => {
    const traceId = getRequestTraceId({headers: {}});
    expect(traceId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });
});
