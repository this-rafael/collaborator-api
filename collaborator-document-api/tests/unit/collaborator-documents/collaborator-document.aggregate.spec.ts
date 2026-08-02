import {describe, expect, it} from "vitest";

const aggregateModule =
  "../../../src/modules/collaborator-documents/domain/aggregates/collaborator-document.js";

const id = "66a64ab05bd7213b90d9c001";
const collaboratorId = "66a64ab05bd7213b90d9b001";
const documentTypeId = "66a64ab05bd7213b90d9b010";
const now = new Date("2026-07-30T12:00:00.000Z");

describe("CollaboratorDocument aggregate", () => {
  it("starts a new cycle as active PENDING with version 0 and empty history", async () => {
    const {CollaboratorDocument} = await import(aggregateModule);
    const result = CollaboratorDocument.createPendingCycle(
      {id, collaboratorId, documentTypeId},
      now
    );

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const document = result.value;
      expect(document.props).toMatchObject({
        id,
        collaboratorId,
        documentTypeId,
        status: "PENDING",
        currentVersion: 0,
        versions: [],
        lastSubmittedAt: null,
        unlinkedAt: null,
        deletedAt: null
      });
      expect(document.props.linkedAt).toEqual(now);
      expect(document.props.createdAt).toEqual(now);
      expect(document.props.updatedAt).toEqual(now);
    }
  });

  it("rejects invalid identifiers and clocks as validation failures", async () => {
    const {CollaboratorDocument} = await import(aggregateModule);
    const results = [
      CollaboratorDocument.createPendingCycle(
        {id: "not-an-object-id", collaboratorId, documentTypeId},
        now
      ),
      CollaboratorDocument.createPendingCycle({id, collaboratorId: "bad", documentTypeId}, now),
      CollaboratorDocument.createPendingCycle({id, collaboratorId, documentTypeId: "bad"}, now),
      CollaboratorDocument.createPendingCycle(
        {id, collaboratorId, documentTypeId},
        new Date("invalid")
      )
    ];

    for (const result of results) {
      expect(result.isErr()).toBe(true);
      if (result.isErr()) expect(result.error.code).toBe("VALIDATION_ERROR");
    }
  });

  it("protects date state from external mutation", async () => {
    const {CollaboratorDocument} = await import(aggregateModule);
    const document = CollaboratorDocument.createPendingCycle(
      {id, collaboratorId, documentTypeId},
      now
    )._unsafeUnwrap();
    const props = document.props;
    props.createdAt.setFullYear(2000);
    props.linkedAt.setFullYear(2000);

    expect(document.props.createdAt).toEqual(now);
    expect(document.props.linkedAt).toEqual(now);
  });

  it("rejects non-string identifiers when starting a pending cycle", async () => {
    const {CollaboratorDocument} = await import(aggregateModule);
    const results = [
      CollaboratorDocument.createPendingCycle({id: 1, collaboratorId, documentTypeId}, now),
      CollaboratorDocument.createPendingCycle({id, collaboratorId: null, documentTypeId}, now),
      CollaboratorDocument.createPendingCycle({id, collaboratorId, documentTypeId: undefined}, now)
    ];

    for (const result of results) {
      expect(result.isErr()).toBe(true);
      if (result.isErr()) expect(result.error.code).toBe("VALIDATION_ERROR");
    }
  });

  it("reconstitutes SUBMITTED history and rejects invalid persisted state", async () => {
    const {CollaboratorDocument} = await import(aggregateModule);
    const {DocumentStatus} =
      await import("../../../src/modules/collaborator-documents/domain/value-objects/document-status.js");
    const submittedAt = new Date("2026-07-30T12:30:00.000Z");
    const unlinkedAt = new Date("2026-07-30T13:00:00.000Z");
    const deletedAt = new Date("2026-07-30T14:00:00.000Z");
    const invalidDate = new Date("invalid");

    expect(DocumentStatus.create("SUBMITTED").isOk()).toBe(true);
    expect(DocumentStatus.create("NOPE").isErr()).toBe(true);

    const valid = CollaboratorDocument.reconstitute({
      id,
      collaboratorId,
      documentTypeId,
      status: "SUBMITTED",
      currentVersion: 1,
      versions: [{version: 1}],
      lastSubmittedAt: submittedAt,
      linkedAt: now,
      unlinkedAt,
      createdAt: now,
      updatedAt: now,
      deletedAt
    });
    expect(valid.isOk()).toBe(true);
    if (valid.isOk()) {
      expect(valid.value.props).toMatchObject({
        status: "SUBMITTED",
        currentVersion: 1,
        lastSubmittedAt: submittedAt,
        unlinkedAt,
        deletedAt
      });
    }

    const failures = [
      CollaboratorDocument.reconstitute({
        id,
        collaboratorId,
        documentTypeId,
        status: "NOPE" as "PENDING",
        currentVersion: 0,
        versions: [],
        lastSubmittedAt: null,
        linkedAt: now,
        unlinkedAt: null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null
      }),
      CollaboratorDocument.reconstitute({
        id: "bad",
        collaboratorId,
        documentTypeId,
        status: "PENDING",
        currentVersion: 0,
        versions: [],
        lastSubmittedAt: null,
        linkedAt: now,
        unlinkedAt: null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null
      }),
      CollaboratorDocument.reconstitute({
        id,
        collaboratorId,
        documentTypeId,
        status: "PENDING",
        currentVersion: 0,
        versions: [],
        lastSubmittedAt: null,
        linkedAt: invalidDate,
        unlinkedAt: null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null
      }),
      CollaboratorDocument.reconstitute({
        id,
        collaboratorId,
        documentTypeId,
        status: "PENDING",
        currentVersion: 0,
        versions: [],
        lastSubmittedAt: null,
        linkedAt: now,
        unlinkedAt: null,
        createdAt: now,
        updatedAt: now,
        deletedAt: invalidDate
      }),
      CollaboratorDocument.reconstitute({
        id,
        collaboratorId,
        documentTypeId,
        status: "PENDING",
        currentVersion: 0,
        versions: [],
        lastSubmittedAt: null,
        linkedAt: now,
        unlinkedAt: invalidDate,
        createdAt: now,
        updatedAt: now,
        deletedAt: null
      }),
      CollaboratorDocument.reconstitute({
        id,
        collaboratorId,
        documentTypeId,
        status: "PENDING",
        currentVersion: 0,
        versions: [],
        lastSubmittedAt: invalidDate,
        linkedAt: now,
        unlinkedAt: null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null
      }),
      CollaboratorDocument.reconstitute({
        id,
        collaboratorId,
        documentTypeId,
        status: "PENDING",
        currentVersion: -1,
        versions: [],
        lastSubmittedAt: null,
        linkedAt: now,
        unlinkedAt: null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null
      }),
      CollaboratorDocument.reconstitute({
        id,
        collaboratorId,
        documentTypeId,
        status: "PENDING",
        currentVersion: 0,
        versions: "nope" as unknown as [],
        lastSubmittedAt: null,
        linkedAt: now,
        unlinkedAt: null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null
      })
    ];

    for (const result of failures) {
      expect(result.isErr()).toBe(true);
      if (result.isErr()) expect(result.error.code).toBe("VALIDATION_ERROR");
    }
  });

  // BDD gap: LINK-SUBMITTED describes a valid lifecycle, but not corruption found on hydration.
  it("rejects persisted histories that violate the document lifecycle", async () => {
    const {CollaboratorDocument} = await import(aggregateModule);
    const submittedAt = new Date("2026-07-30T12:30:00.000Z");
    const persisted = {
      id,
      collaboratorId,
      documentTypeId,
      status: "SUBMITTED" as const,
      currentVersion: 3,
      versions: [{version: 1}, {version: 2}, {version: 3}],
      lastSubmittedAt: submittedAt,
      linkedAt: now,
      unlinkedAt: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    };

    expect(CollaboratorDocument.reconstitute(persisted).isOk()).toBe(true);

    const invalidStates = [
      {...persisted, collaboratorId: "invalid"},
      {...persisted, documentTypeId: "invalid"},
      {
        ...persisted,
        status: "PENDING" as const,
        currentVersion: 1,
        versions: [],
        lastSubmittedAt: null
      },
      {
        ...persisted,
        status: "PENDING" as const,
        currentVersion: 0,
        versions: [{version: 1}],
        lastSubmittedAt: null
      },
      {
        ...persisted,
        status: "PENDING" as const,
        currentVersion: 0,
        versions: [],
        lastSubmittedAt: submittedAt
      },
      {...persisted, currentVersion: 0, versions: []},
      {...persisted, versions: [{version: 1}, {version: 3}]},
      {...persisted, currentVersion: 2, versions: [{version: 1}, {version: 1}]},
      {...persisted, currentVersion: 2, versions: [{version: 2}, {version: 1}]},
      {...persisted, currentVersion: 1, versions: [{version: 0}]},
      {...persisted, currentVersion: 1, versions: [{version: 1.5}]}
    ];

    for (const state of invalidStates) {
      const result = CollaboratorDocument.reconstitute(state);
      expect(result.isErr()).toBe(true);
      if (result.isErr()) expect(result.error.code).toBe("VALIDATION_ERROR");
    }
  });
});
