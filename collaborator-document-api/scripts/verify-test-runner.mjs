import {spawnSync} from "node:child_process";

const result = spawnSync(
  "pnpm",
  ["exec", "vitest", "run", "--config", "tests/fixtures/vitest.failure.config.ts"],
  {
    stdio: "ignore"
  }
);

if (result.status === 0) {
  throw new Error("Vitest accepted an intentionally failing assertion");
}
