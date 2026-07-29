import {describe, expect, it} from "vitest";

import {GetReadinessQuery} from "../../src/shared/application/queries/get-readiness.query.js";
import {healthStatusFixture} from "../helpers/health-fixtures.js";
import {AlwaysReady, FailingReadiness, NeverReady} from "../helpers/health-runtime.js";
import {assertNoInternalLeak} from "../helpers/health-runtime.js";

describe("GetReadinessQuery (HEALTH-READY-001 / HEALTH-READY-002 / HEALTH-READY-003)", () => {
  it("returns Ok(HealthStatus) when the dependency is ready", async () => {
    const query = new GetReadinessQuery(new AlwaysReady());
    const result = await query.execute();

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toEqual(healthStatusFixture);
    }
  });

  it("returns Err with SERVICE_UNAVAILABLE when the dependency is not ready", async () => {
    const query = new GetReadinessQuery(new NeverReady());
    const result = await query.execute();

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("SERVICE_UNAVAILABLE");
      expect(result.error.kind).toBe("application");
    }
  });

  it("maps an enriched failure to Err without leaking internal details", async () => {
    const query = new GetReadinessQuery(new FailingReadiness());
    const result = await query.execute();

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      const serialized = JSON.stringify({
        code: result.error.code,
        message: result.error.message
      });
      expect(serialized).not.toContain("super-secret-password");
      expect(serialized).not.toContain("mongodb://");
      assertNoInternalLeak(serialized);
    }
  });
});
