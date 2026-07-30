export interface CollaboratorDocumentFixture {
  id: string;
  collaboratorId: string;
  documentTypeId: string;
  status: "PENDING" | "SUBMITTED";
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
  deletedAt: null,
  versionCount: 1,
  ...overrides
});

export const pendingDocumentTypeLinkFixture = (
  overrides: Partial<CollaboratorDocumentFixture> = {}
): CollaboratorDocumentFixture =>
  activeCollaboratorDocumentFixture({
    status: "PENDING",
    ...overrides
  });

export const submittedDocumentTypeLinkFixture = (
  overrides: Partial<CollaboratorDocumentFixture> = {}
): CollaboratorDocumentFixture =>
  activeCollaboratorDocumentFixture({
    id: "66a64ab05bd7213b90d9c002",
    status: "SUBMITTED",
    ...overrides
  });
