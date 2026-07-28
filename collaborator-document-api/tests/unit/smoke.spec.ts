import {describe, expect, it} from "vitest";

import {loadEnv} from "../../src/config/env.js";

describe("loadEnv", () => {
  it("applies defaults for missing values", () => {
    const env = loadEnv({});

    expect(env.nodeEnv).toBe("development");
    expect(env.port).toBe(3000);
    expect(env.mongodbUri).toContain("replicaSet=rs0");
    expect(env.logLevel).toBe("info");
  });

  it("reads explicit environment values", () => {
    const env = loadEnv({
      NODE_ENV: "test",
      PORT: "4000",
      MONGODB_URI: "mongodb://localhost:27017/test?replicaSet=rs0",
      LOG_LEVEL: "debug"
    });

    expect(env).toEqual({
      nodeEnv: "test",
      port: 4000,
      mongodbUri: "mongodb://localhost:27017/test?replicaSet=rs0",
      logLevel: "debug"
    });
  });

  it("rejects invalid PORT values", () => {
    expect(() => loadEnv({PORT: "abc"})).toThrow(/Invalid numeric environment value/);
  });
});
