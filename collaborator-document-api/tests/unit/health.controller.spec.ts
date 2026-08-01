import type {Response} from "express";
import {afterEach, describe, expect, it, vi} from "vitest";

import {HealthController} from "../../src/controllers/health.controller.js";
import type {MongoReadinessCheck} from "../../src/shared/infrastructure/availability/mongo-readiness-check.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("HealthController", () => {
  it("returns service unavailable when the live readiness check fails", async () => {
    vi.stubEnv("HEALTH_TEST_READINESS", "");
    const readinessCheck = {
      isReady: vi.fn().mockResolvedValue(false)
    } as unknown as MongoReadinessCheck;
    const response = {
      req: {headers: {"x-request-id": "health-trace"}},
      status: vi.fn(),
      type: vi.fn(),
      end: vi.fn()
    } as unknown as Response;
    vi.mocked(response.status).mockReturnValue(response);
    vi.mocked(response.type).mockReturnValue(response);

    await new HealthController(readinessCheck).ready(response);

    expect(readinessCheck.isReady).toHaveBeenCalledOnce();
    expect(response.status).toHaveBeenCalledWith(503);
    expect(response.type).toHaveBeenCalledWith("application/problem+json");
    expect(response.end).toHaveBeenCalledOnce();
  });
});
