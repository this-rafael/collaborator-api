import {afterAll, beforeAll, describe, expect, it} from "vitest";
import {PlatformTest} from "@tsed/platform-http/testing";

import {Server} from "../../src/Server.js";
import {loadListCollaboratorsSliceFromExpected} from "../helpers/openapi-slice.js";
import {publishedOperation} from "./collaborators-contract.helpers.js";

// COL-LIST-001…020, CURSOR-001, CURSOR-002
describe("Published list collaborators contract", () => {
  beforeAll(PlatformTest.bootstrap(Server));
  afterAll(PlatformTest.reset);

  it("publishes the collection operation with cursor filters cache and problem responses", async () => {
    const operation = await publishedOperation("/api/v1/collaborators", "get");
    expect(operation.operationId).toBe(
      loadListCollaboratorsSliceFromExpected().operation.operationId
    );
    expect(operation.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({name: "cursor"}),
        expect.objectContaining({name: "limit"})
      ])
    );
    expect(operation.responses).toMatchObject({
      "200": expect.anything(),
      "304": expect.anything(),
      "400": expect.anything(),
      "429": expect.anything()
    });
  });
});
