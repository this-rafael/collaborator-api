import {describe, expect, it} from "vitest";

import {CollaboratorRepositoryStub} from "../helpers/collaborator-runtime.js";

// COL-LIST-001
describe("Listing collaborators in the application layer", () => {
  it("excludes deleted collaborators from the default result", async () => {
    const {ListCollaboratorsQuery} =
      await import("../../src/modules/collaborators/application/queries/list-collaborators.query.js");
    const result = await new ListCollaboratorsQuery(new CollaboratorRepositoryStub()).execute(
      {},
      {limit: 20}
    );
    expect(result.isOk()).toBe(true);
    if (result.isOk())
      expect(
        result.value.items.every((item: {deletedAt: Date | null}) => item.deletedAt === null)
      ).toBe(true);
  });

  it("maps repository list failures to {code}", async () => {
    const {ListCollaboratorsQuery} =
      await import("../../src/modules/collaborators/application/queries/list-collaborators.query.js");
    const result = await new ListCollaboratorsQuery(
      CollaboratorRepositoryStub.unavailable()
    ).execute({}, {limit: 20});
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe("SERVICE_UNAVAILABLE");
  });
});
