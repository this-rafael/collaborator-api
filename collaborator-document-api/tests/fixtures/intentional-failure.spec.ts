import {expect, it} from "vitest";

it("fails intentionally", () => {
  expect("intentional failure").toBe("accepted result");
});
