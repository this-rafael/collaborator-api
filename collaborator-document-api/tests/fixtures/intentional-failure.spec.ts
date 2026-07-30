import {expect, it} from "vitest";

it("fails intentionally", () => {
  expect(() => {
    throw new Error("intentional");
  }).toThrow("intentional");
});
