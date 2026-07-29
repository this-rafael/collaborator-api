import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

const {ping, connection} = vi.hoisted(() => {
  const ping = vi.fn();
  const connection: {
    readyState: number;
    db: {admin: () => {ping: typeof ping}};
  } = {
    readyState: 1,
    db: {admin: () => ({ping})}
  };
  return {ping, connection};
});

vi.mock("mongoose", () => ({default: {connection}}));

import {MongoReadinessCheck} from "../../src/shared/infrastructure/availability/mongo-readiness-check.js";

describe("MongoReadinessCheck", () => {
  beforeEach(() => {
    delete process.env.NODE_ENV;
    delete process.env.HEALTH_TEST_READINESS;
    connection.readyState = 1;
    ping.mockReset();
  });

  afterEach(() => {
    delete process.env.HEALTH_TEST_READINESS;
  });

  it("returns true when the connection is ready and the ping succeeds", async () => {
    ping.mockResolvedValue({ok: 1});
    const check = new MongoReadinessCheck();
    expect(await check.isReady()).toBe(true);
  });

  it("returns false when the connection is not established", async () => {
    connection.readyState = 0;
    const check = new MongoReadinessCheck();
    expect(await check.isReady()).toBe(false);
  });

  it("returns false when the ping throws", async () => {
    ping.mockRejectedValue(new Error("MongoServerSelectionError: ECONNREFUSED"));
    const check = new MongoReadinessCheck();
    expect(await check.isReady()).toBe(false);
  });
});
