import {describe, expect, it} from "vitest";

import {
  linkDeletedFixture,
  linkPendingFixture,
  linkUnlinkedFixture
} from "../../helpers/collaborator-document-fixtures.js";

const listUseCaseModule =
  "../../../src/modules/collaborator-documents/application/use-cases/list-collaborator-documents.use-case.js";

describe("Collaborator document lifecycle classification", () => {
  it.each([
    ["active", linkPendingFixture(), "active"],
    ["unlinked", linkUnlinkedFixture(), "unlinked"],
    ["deleted", linkDeletedFixture(), "deleted"],
    [
      "deleted takes precedence over unlinked",
      linkDeletedFixture({unlinkedAt: "2026-07-30T13:30:00.000Z"}),
      "deleted"
    ]
  ])("classifies %s deterministically", async (_case, fixture, expected) => {
    const module = await import(listUseCaseModule);

    expect(module.classifyLifecycle(fixture)).toBe(expected);
  });
});
