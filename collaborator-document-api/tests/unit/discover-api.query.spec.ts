import {describe, expect, it} from "vitest";

import {DiscoverApiQuery} from "../../src/shared/application/queries/discover-api.query.js";
import {apiRootPresenter} from "../../src/shared/presentation/http/presenters/api-root.presenter.js";
import {
  AlwaysAvailable,
  NeverAvailable,
  ToggleableAvailability
} from "../helpers/discovery-runtime.js";
import {
  apiRootFixture,
  requiredDiscoveryRelations,
  templatedDiscoveryRelations
} from "../helpers/discovery-fixtures.js";

const traceIdFixture = "01J3Y2QHB8FV4RGY7Y1QXNT2D4";

describe("discoverApi query and presenter", () => {
  it("returns the deterministic ApiRoot when the dependency is available", async () => {
    const query = new DiscoverApiQuery(new AlwaysAvailable());
    const result = await query.execute();

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const root = result.value;
      expect(root.name).toBe("Collaborator Document API");
      expect(root.version).toBe("1");
      expect(Object.keys(root._links).sort()).toEqual([...requiredDiscoveryRelations].sort());
    }
  });

  it("returns Err with SERVICE_UNAVAILABLE code when the dependency is unavailable", async () => {
    const query = new DiscoverApiQuery(new NeverAvailable());
    const result = await query.execute();

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("SERVICE_UNAVAILABLE");
      expect(result.error.kind).toBe("application");
    }
  });

  it("transitions from unavailable back to available without leaking previous state", async () => {
    const availability = new ToggleableAvailability(false);
    const query = new DiscoverApiQuery(availability);

    const first = await query.execute();
    expect(first.isErr()).toBe(true);

    availability.setAvailable(true);
    const second = await query.execute();
    expect(second.isOk()).toBe(true);
  });

  it("uses the presenter to produce exactly the nine contracted relations", () => {
    const presented = apiRootPresenter(apiRootFixture);
    expect(presented.name).toBe("Collaborator Document API");
    expect(presented.version).toBe("1");
    expect(Object.keys(presented._links).sort()).toEqual([...requiredDiscoveryRelations].sort());

    for (const relation of requiredDiscoveryRelations) {
      expect(presented._links[relation]).toBeDefined();
      expect(presented._links[relation]?.href).toMatch(/^\/api\/v1/);
    }
  });

  it("marks only parameterized relations as templated", () => {
    const presented = apiRootPresenter(apiRootFixture);
    for (const relation of templatedDiscoveryRelations) {
      expect(presented._links[relation]?.templated).toBe(true);
    }
    expect(presented._links.self?.templated).toBeFalsy();
    expect(presented._links.completeness?.templated).toBeFalsy();
  });

  it("does not introduce extra relations outside the nine contracted names", () => {
    const presented = apiRootPresenter(apiRootFixture);
    const presentedRelations = Object.keys(presented._links);
    expect(presentedRelations).toHaveLength(requiredDiscoveryRelations.length);
    for (const relation of presentedRelations) {
      expect(requiredDiscoveryRelations).toContain(relation);
    }
  });

  it("preserves trace id propagation semantics for the query (no trace id field in body)", () => {
    const presented = apiRootPresenter(apiRootFixture);
    const body = JSON.stringify(presented);
    expect(body).not.toContain(traceIdFixture);
    expect(body).not.toMatch(/traceId/i);
  });
});
