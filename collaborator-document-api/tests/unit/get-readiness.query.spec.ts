import {describe, expect, it} from "vitest";

import type {ReadinessCheck} from "../../src/shared/application/ports/readiness-check.js";
import {GetReadinessQuery} from "../../src/shared/application/queries/get-readiness.query.js";

class ReadyCheck implements ReadinessCheck {
  isReady(): boolean {
    return true;
  }
}

class NotReadyCheck implements ReadinessCheck {
  isReady(): boolean {
    return false;
  }
}

class ThrowingCheck implements ReadinessCheck {
  isReady(): never {
    throw new Error("ping failed");
  }
}

describe("GetReadinessQuery", () => {
  it("returns ok when the readiness check reports ready", async () => {
    const result = await new GetReadinessQuery(new ReadyCheck()).execute();

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toEqual({status: "ok"});
    }
  });

  it("returns SERVICE_UNAVAILABLE when the readiness check reports not ready", async () => {
    const result = await new GetReadinessQuery(new NotReadyCheck()).execute();

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("SERVICE_UNAVAILABLE");
      expect(result.error.kind).toBe("application");
    }
  });

  it("returns SERVICE_UNAVAILABLE when the readiness check throws", async () => {
    const result = await new GetReadinessQuery(new ThrowingCheck()).execute();

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("SERVICE_UNAVAILABLE");
      expect(result.error.kind).toBe("application");
    }
  });
});
