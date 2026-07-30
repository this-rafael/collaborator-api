import {afterEach, describe, expect, it} from "vitest";

import {MongoReadinessCheck} from "../../src/shared/infrastructure/availability/mongo-readiness-check.js";

type FakeConnection = {
  readyState: number;
  db?: {admin: () => {ping: () => Promise<unknown>}};
};

const createCheck = (connection: FakeConnection | null | undefined): MongoReadinessCheck =>
  new MongoReadinessCheck({get: () => connection} as never);

describe("MongoReadinessCheck", () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousForced = process.env.HEALTH_TEST_READINESS;

  afterEach(() => {
    if (previousNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousNodeEnv;
    }
    if (previousForced === undefined) {
      delete process.env.HEALTH_TEST_READINESS;
    } else {
      process.env.HEALTH_TEST_READINESS = previousForced;
    }
  });

  it("returns true when HEALTH_TEST_READINESS=available under test", async () => {
    process.env.NODE_ENV = "test";
    process.env.HEALTH_TEST_READINESS = "available";

    await expect(createCheck(null).isReady()).resolves.toBe(true);
  });

  it("returns false when HEALTH_TEST_READINESS=unavailable under test", async () => {
    process.env.NODE_ENV = "test";
    process.env.HEALTH_TEST_READINESS = "unavailable";

    await expect(createCheck(null).isReady()).resolves.toBe(false);
  });

  it("returns false when the mongoose connection is missing", async () => {
    process.env.NODE_ENV = "test";
    delete process.env.HEALTH_TEST_READINESS;

    await expect(createCheck(undefined).isReady()).resolves.toBe(false);
    await expect(createCheck(null).isReady()).resolves.toBe(false);
  });

  it("returns false when the connection readyState is not connected", async () => {
    process.env.NODE_ENV = "test";
    delete process.env.HEALTH_TEST_READINESS;

    await expect(createCheck({readyState: 0}).isReady()).resolves.toBe(false);
    await expect(createCheck({readyState: 2}).isReady()).resolves.toBe(false);
  });

  it("returns true when admin ping succeeds on a ready connection", async () => {
    process.env.NODE_ENV = "test";
    delete process.env.HEALTH_TEST_READINESS;

    const check = createCheck({
      readyState: 1,
      db: {admin: () => ({ping: async () => ({ok: 1})})}
    });

    await expect(check.isReady()).resolves.toBe(true);
  });

  it("returns false when admin ping throws", async () => {
    process.env.NODE_ENV = "test";
    delete process.env.HEALTH_TEST_READINESS;

    const check = createCheck({
      readyState: 1,
      db: {
        admin: () => ({
          ping: async () => {
            throw new Error("network error");
          }
        })
      }
    });

    await expect(check.isReady()).resolves.toBe(false);
  });
});
