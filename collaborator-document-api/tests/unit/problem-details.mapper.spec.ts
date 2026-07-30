import {describe, expect, it} from "vitest";

import {ProblemDetailsMapper} from "../../src/shared/presentation/http/errors/problem-details.mapper.js";
import {applicationFailure} from "../../src/shared/application/errors/application-failure.js";
import {domainFailure} from "../../src/shared/domain/errors/domain-failure.js";
import {
  problemDetailsFixture,
  problemDetailsRateLimitFixture,
  problemDetailsServiceUnavailableFixture
} from "../helpers/discovery-fixtures.js";
import {fixedTraceId} from "../helpers/discovery-runtime.js";

describe("Problem Details mapper", () => {
  it("maps a rate limit failure to 429 with RATE_LIMIT_EXCEEDED and Retry-After >= 1", () => {
    const mapper = new ProblemDetailsMapper();
    const failure = applicationFailure("RATE_LIMIT_EXCEEDED", "Limite excedido para discoverApi");
    const {problem, retryAfter} = mapper.fromFailure(failure, {
      instance: "/api/v1",
      traceId: fixedTraceId
    });

    expect(problem.status).toBe(429);
    expect(problem.code).toBe("RATE_LIMIT_EXCEEDED");
    expect(problem.instance).toBe("/api/v1");
    expect(problem.traceId).toBe(fixedTraceId);
    expect(retryAfter).toBeDefined();
    expect(retryAfter).toBeGreaterThanOrEqual(1);
    expect(problem.type).toBe(problemDetailsRateLimitFixture().type);
    expect(problem.title).toBe(problemDetailsRateLimitFixture().title);
  });

  it("maps a service unavailable failure to 503 with SERVICE_UNAVAILABLE", () => {
    const mapper = new ProblemDetailsMapper();
    const failure = applicationFailure("SERVICE_UNAVAILABLE", "MongoDB indisponível");
    const {problem} = mapper.fromFailure(failure, {instance: "/api/v1", traceId: fixedTraceId});

    expect(problem.status).toBe(503);
    expect(problem.code).toBe("SERVICE_UNAVAILABLE");
    expect(problem.title).toBe(problemDetailsServiceUnavailableFixture().title);
    expect(problem.type).toBe(problemDetailsServiceUnavailableFixture().type);
    expect(problem.instance).toBe("/api/v1");
    expect(problem.traceId).toBe(fixedTraceId);
  });

  it("maps a domain failure with status and code declared by the failure", () => {
    const mapper = new ProblemDetailsMapper();
    const failure = domainFailure("INVALID_QUERY_PARAMETER", "cursor expirado");
    const {problem} = mapper.fromFailure(failure, {instance: "/api/v1", traceId: fixedTraceId});

    expect(problem.code).toBe("INVALID_QUERY_PARAMETER");
    expect(problem.instance).toBe("/api/v1");
    expect(problem.traceId).toBe(fixedTraceId);
  });

  it("falls back to 500 INTERNAL_SERVER_ERROR when the failure has no recognized code", () => {
    const mapper = new ProblemDetailsMapper();
    const failure = applicationFailure("SOMETHING_UNEXPECTED", "detalhe privado");
    const {problem} = mapper.fromFailure(failure, {instance: "/api/v1", traceId: fixedTraceId});

    expect(problem.status).toBe(500);
    expect(problem.code).toBe("INTERNAL_SERVER_ERROR");
    expect(problem.title).toBe(problemDetailsFixture().title);
    expect(problem.type).toBe(problemDetailsFixture().type);
    expect(problem.instance).toBe("/api/v1");
  });

  it("never propagates the original error message into the problem body", () => {
    const mapper = new ProblemDetailsMapper();
    const sensitive = "mongodb://user:hunter2@cluster0.example.com/admin";
    const failure = applicationFailure("SOMETHING_UNEXPECTED", sensitive);
    const {problem} = mapper.fromFailure(failure, {instance: "/api/v1", traceId: fixedTraceId});

    const serialized = JSON.stringify(problem);
    expect(serialized).not.toContain(sensitive);
    expect(serialized).not.toContain("hunter2");
    expect(serialized).not.toMatch(/mongodb:\/\//i);
  });

  it("always populates the seven mandatory Problem Details fields", () => {
    const mapper = new ProblemDetailsMapper();
    const failure = applicationFailure("RATE_LIMIT_EXCEEDED", "Limite excedido");
    const {problem} = mapper.fromFailure(failure, {instance: "/api/v1", traceId: fixedTraceId});

    for (const field of ["type", "title", "status", "detail", "instance", "code", "traceId"]) {
      expect(problem).toHaveProperty(field);
      expect((problem as Record<string, unknown>)[field]).toBeDefined();
    }
    expect(problem.status).toBeGreaterThanOrEqual(400);
    expect(problem.status).toBeLessThanOrEqual(599);
  });

  it("ignores any pre-existing traceId inside the failure message", () => {
    const mapper = new ProblemDetailsMapper();
    const failure = applicationFailure(
      "SOMETHING_UNEXPECTED",
      "01J3Y2QHB8FV4RGY7Y1QXNT2D4 mongodb stack"
    );
    const {problem} = mapper.fromFailure(failure, {instance: "/api/v1", traceId: fixedTraceId});

    const serialized = JSON.stringify(problem);
    expect(serialized).not.toContain("mongodb");
    expect(problem.traceId).toBe(fixedTraceId);
  });

  it("sanitizes an unknown domain failure code to INTERNAL_SERVER_ERROR", () => {
    const mapper = new ProblemDetailsMapper();
    const failure = domainFailure("UNKNOWN_DOMAIN_CODE", "detalhe privado");
    const {problem} = mapper.fromFailure(failure, {instance: "/api/v1", traceId: fixedTraceId});

    expect(problem.status).toBe(500);
    expect(problem.code).toBe("INTERNAL_SERVER_ERROR");
    expect(problem.title).toBe(problemDetailsFixture().title);
  });

  it("defaults application failures without a code to INTERNAL_SERVER_ERROR", () => {
    const mapper = new ProblemDetailsMapper();
    const {problem} = mapper.fromFailure(
      {kind: "application", message: "sem código"},
      {instance: "/api/v1", traceId: fixedTraceId}
    );

    expect(problem.status).toBe(500);
    expect(problem.code).toBe("INTERNAL_SERVER_ERROR");
  });
});
