export interface CollaboratorDocumentFixture {
  id: string;
  collaboratorId: string;
  status: "PENDING" | "SUBMITTED";
  deletedAt: string | null;
  versionCount: number;
}

export const activeCollaboratorDocumentFixture = (
  overrides: Partial<CollaboratorDocumentFixture> = {}
): CollaboratorDocumentFixture => ({
  id: "66a64ab05bd7213b90d9c001",
  collaboratorId: "66a64ab05bd7213b90d9b001",
  status: "PENDING",
  deletedAt: null,
  versionCount: 1,
  ...overrides
});
