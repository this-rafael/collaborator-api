export interface CollaboratorDocumentFixture {
  id: string;
  collaboratorId: string;
  documentTypeId: string;
  status: "PENDING" | "SUBMITTED";
  currentVersion: number;
  versions: readonly unknown[];
  lastSubmittedAt: string | null;
  linkedAt: string;
  unlinkedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  versionCount: number;
}

export const activeCollaboratorDocumentFixture = (
  overrides: Partial<CollaboratorDocumentFixture> = {}
): CollaboratorDocumentFixture => ({
  id: "66a64ab05bd7213b90d9c001",
  collaboratorId: "66a64ab05bd7213b90d9b001",
  documentTypeId: "66a64ab05bd7213b90d9b010",
  status: "PENDING",
  currentVersion: 0,
  versions: [],
  lastSubmittedAt: null,
  linkedAt: "2026-07-30T12:00:00.000Z",
  unlinkedAt: null,
  createdAt: "2026-07-30T12:00:00.000Z",
  updatedAt: "2026-07-30T12:00:00.000Z",
  deletedAt: null,
  versionCount: 0,
  ...overrides
});

/** LINK-PENDING: ciclo novo, ativo e sem versões submetidas. */
export const linkPendingFixture = (
  overrides: Partial<CollaboratorDocumentFixture> = {}
): CollaboratorDocumentFixture =>
  activeCollaboratorDocumentFixture({
    status: "PENDING",
    currentVersion: 0,
    versions: [],
    lastSubmittedAt: null,
    unlinkedAt: null,
    deletedAt: null,
    versionCount: 0,
    ...overrides
  });

/** LINK-UNLINKED: ciclo anterior encerrado, preservando o histórico. */
export const linkUnlinkedFixture = (
  overrides: Partial<CollaboratorDocumentFixture> = {}
): CollaboratorDocumentFixture =>
  activeCollaboratorDocumentFixture({
    id: "66a64ab05bd7213b90d9c002",
    status: "SUBMITTED",
    currentVersion: 1,
    versions: [{version: 1}],
    lastSubmittedAt: "2026-07-30T12:30:00.000Z",
    unlinkedAt: "2026-07-30T13:00:00.000Z",
    updatedAt: "2026-07-30T13:00:00.000Z",
    versionCount: 1,
    ...overrides
  });

/** COL-ACTIVE: colaborador pai apto para iniciar um vínculo. */
export const activeCollaboratorForLinkFixture = (
  overrides: Partial<{id: string; deletedAt: string | null}> = {}
) => ({
  id: "66a64ab05bd7213b90d9b001",
  deletedAt: null,
  ...overrides
});

/** TYPE-ACTIVE: tipo de documento pai apto para iniciar um vínculo. */
export const activeDocumentTypeForLinkFixture = (
  overrides: Partial<{id: string; deletedAt: string | null}> = {}
) => ({
  id: "66a64ab05bd7213b90d9b010",
  deletedAt: null,
  ...overrides
});

export const validCollaboratorDocumentBody = (
  overrides: Partial<Record<"collaboratorId" | "documentTypeId", unknown>> = {}
) => ({
  collaboratorId: activeCollaboratorForLinkFixture().id,
  documentTypeId: activeDocumentTypeForLinkFixture().id,
  ...overrides
});

export const invalidCollaboratorDocumentBodies = {
  missingCollaboratorId: {documentTypeId: activeDocumentTypeForLinkFixture().id},
  missingDocumentTypeId: {collaboratorId: activeCollaboratorForLinkFixture().id},
  invalidCollaboratorId: validCollaboratorDocumentBody({collaboratorId: "not-an-object-id"}),
  invalidDocumentTypeId: validCollaboratorDocumentBody({documentTypeId: "not-an-object-id"}),
  extraProperty: {...validCollaboratorDocumentBody(), unexpected: true}
};

export const pendingDocumentTypeLinkFixture = (
  overrides: Partial<CollaboratorDocumentFixture> = {}
): CollaboratorDocumentFixture => linkPendingFixture(overrides);

export const submittedDocumentTypeLinkFixture = (
  overrides: Partial<CollaboratorDocumentFixture> = {}
): CollaboratorDocumentFixture =>
  activeCollaboratorDocumentFixture({
    id: "66a64ab05bd7213b90d9c002",
    status: "SUBMITTED",
    currentVersion: 1,
    versions: [{version: 1}],
    lastSubmittedAt: "2026-07-30T12:30:00.000Z",
    versionCount: 1,
    ...overrides
  });
