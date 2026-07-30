import {describe, expect, it} from "vitest";

import {
  GlobalErrorFilter,
  globalErrorMiddleware
} from "../../src/shared/presentation/http/filters/global-error.filter.js";

function buildResponse(path?: string) {
  const state = {status: 200, type: "", body: undefined as unknown};
  const response = {
    req: path === undefined ? undefined : {path},
    status(code: number) {
      state.status = code;
      return this;
    },
    type(value: string) {
      state.type = value;
      return this;
    },
    json(value: unknown) {
      state.body = value;
      return this;
    }
  };
  return {response, state};
}

describe("GlobalErrorFilter", () => {
  it("writes a sanitized 500 Problem Details response", () => {
    const {response, state} = buildResponse("/api/v1?secret=hidden");
    new GlobalErrorFilter().catch(new Error("private stack"), {response} as never);

    expect(state.status).toBe(500);
    expect(state.type).toBe("application/problem+json");
    expect(state.body).toMatchObject({
      status: 500,
      code: "INTERNAL_SERVER_ERROR",
      instance: "/api/v1"
    });
    expect(JSON.stringify(state.body)).not.toContain("private stack");
  });

  it("supports the Express error middleware signature", () => {
    const {response, state} = buildResponse();
    globalErrorMiddleware(new Error("private stack"), {}, response as never, () => undefined);
    expect(state.status).toBe(500);
    expect(state.type).toBe("application/problem+json");
  });

  it("maps a JSON parser failure to the published 400 problem", () => {
    const {response, state} = buildResponse("/api/v1/collaborators");
    new GlobalErrorFilter().catch({type: "entity.parse.failed"}, {response} as never);

    expect(state.status).toBe(400);
    expect(state.type).toBe("application/problem+json");
    expect(state.body).toMatchObject({
      status: 400,
      code: "MALFORMED_JSON",
      instance: "/api/v1/collaborators"
    });
  });
});
