import {describe, expect, it} from "vitest";

import {GetLivenessQuery} from "../../src/shared/application/queries/get-liveness.query.js";
import {healthStatusFixture} from "../helpers/health-fixtures.js";

describe("GetLivenessQuery (HEALTH-LIVE-001)", () => {
  it("returns the deterministic ok status without depending on external I/O", () => {
    const query = new GetLivenessQuery();
    const result = query.execute();

    expect(result).toEqual(healthStatusFixture);
    expect(result.status).toBe("ok");
  });

  it("produces the same result on repeated calls and never resolves via a port", () => {
    const query = new GetLivenessQuery();

    const first = query.execute();
    const second = query.execute();

    expect(first).toBeInstanceOf(Object);
    expect(second).toEqual(first);
    expect(Object.keys(first)).toEqual(["status"]);
    expect("_links" in first).toBe(false);
  });
});
