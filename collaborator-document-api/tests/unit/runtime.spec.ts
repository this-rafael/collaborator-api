import {describe, expect, it} from "vitest";

import {validateRuntime} from "../../scripts/check-runtime.mjs";

describe("FND-RUNTIME", () => {
  it("FND-RUNTIME-001 accepts supported Node and pnpm", () => {
    expect(
      validateRuntime({
        nodeVersion: "v24.18.0",
        packageManagerUserAgent: "pnpm/11.9.0 npm/? node/v24.18.0"
      })
    ).toEqual([]);
  });

  it("FND-RUNTIME-002 rejects unsupported runtimes", () => {
    expect(
      validateRuntime({nodeVersion: "v22.0.0", packageManagerUserAgent: "npm/10.0.0"})
    ).toHaveLength(2);
  });
});
