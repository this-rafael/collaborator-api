import {describe, expect, it} from "vitest";

import {CollaboratorRepositoryStub} from "../../helpers/collaborator-runtime.js";

// COL-GET-001, COL-GET-005
describe("Getting a collaborator in the application layer", () => {
  it("returns Ok for an existing collaborator", async () => {
    const {GetCollaborator} =
      await import("../../../src/modules/collaborators/application/queries/get-collaborator.query.js");
    expect(
      (
        await new GetCollaborator(new CollaboratorRepositoryStub()).execute(
          "66a64ab05bd7213b90d9b001"
        )
      ).isOk()
    ).toBe(true);
  });

  it("returns Err with a stable not found failure", async () => {
    const {GetCollaborator} =
      await import("../../../src/modules/collaborators/application/queries/get-collaborator.query.js");
    const result = await new GetCollaborator(CollaboratorRepositoryStub.notFound()).execute(
      "66a64ab05bd7213b90d9b099"
    );
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe("COLLABORATOR_NOT_FOUND");
  });
});
