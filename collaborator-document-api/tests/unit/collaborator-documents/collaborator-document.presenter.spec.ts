import {describe, expect, it} from "vitest";

import {
  linkDeletedFixture,
  linkPendingFixture,
  linkSubmittedFixture,
  linkUnlinkedFixture
} from "../../helpers/collaborator-document-fixtures.js";

const presenterModule =
  "../../src/modules/collaborator-documents/presentation/http/presenters/collaborator-document.presenter.js";

describe("collaboratorDocumentPresenter", () => {
  it("publishes submit and unlink actions for an active PENDING link", async () => {
    const module = await import(presenterModule);
    const presented = module.collaboratorDocumentPresenter(linkPendingFixture());

    expect(presented.currentVersion).toBe(0);
    expect(presented.lastSubmittedAt).toBeNull();
    expect(presented._links["submit-version"]).toBeDefined();
    expect(presented._links.unlink).toBeDefined();
    expect(presented._links["current-version"]).toBeUndefined();
  });

  it("publishes current, resubmit, and unlink actions for SUBMITTED", async () => {
    const module = await import(presenterModule);
    const presented = module.collaboratorDocumentPresenter(linkSubmittedFixture());

    expect(presented.currentVersion).toBeGreaterThanOrEqual(1);
    expect(presented.lastSubmittedAt).not.toBeNull();
    expect(presented._links["current-version"]).toBeDefined();
    expect(presented._links["resubmit-version"]).toBeDefined();
    expect(presented._links.unlink).toBeDefined();
  });

  it.each([linkUnlinkedFixture(), linkDeletedFixture()])(
    "removes write actions from historical links: %o",
    async (fixture) => {
      const module = await import(presenterModule);
      const presented = module.collaboratorDocumentPresenter(fixture);

      expect(presented._links["submit-version"]).toBeUndefined();
      expect(presented._links["current-version"]).toBeUndefined();
      expect(presented._links["resubmit-version"]).toBeUndefined();
      expect(presented._links.unlink).toBeUndefined();
      expect(presented._links.self).toBeDefined();
      expect(presented._links.versions).toBeDefined();
    }
  );
});
