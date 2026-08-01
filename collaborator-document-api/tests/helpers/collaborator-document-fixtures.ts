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

export interface DocumentVersionMetadataFixture {
  originalName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  storageKey: string | null;
  notes: string | null;
}

export interface DocumentVersionFixture {
  version: number;
  submittedAt: string;
  metadata: DocumentVersionMetadataFixture;
}

export interface DocumentVersionListPageFixture {
  items: readonly DocumentVersionFixture[];
  currentVersion: number;
  hasNext: boolean;
}

export type DocumentVersionCreateBody = Readonly<{
  metadata: Readonly<{
    originalName: string;
    mimeType?: string | null;
    sizeBytes?: number | null;
    storageKey?: string | null;
    notes?: string | null;
  }>;
}>;

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

/** LINK-DELETED: ciclo removido por cascata, com ou sem unlink anterior. */
export const linkDeletedFixture = (
  overrides: Partial<CollaboratorDocumentFixture> = {}
): CollaboratorDocumentFixture =>
  activeCollaboratorDocumentFixture({
    id: "66a64ab05bd7213b90d9c003",
    status: "PENDING",
    deletedAt: "2026-07-30T14:00:00.000Z",
    updatedAt: "2026-07-30T14:00:00.000Z",
    ...overrides
  });

/** LINK-SUBMITTED: ciclo ativo com histórico e última versão enviada. */
export const linkSubmittedFixture = (
  overrides: Partial<CollaboratorDocumentFixture> = {}
): CollaboratorDocumentFixture =>
  submittedDocumentTypeLinkFixture({
    status: "SUBMITTED",
    currentVersion: 1,
    versions: [{version: 1}],
    lastSubmittedAt: "2026-07-30T12:30:00.000Z",
    unlinkedAt: null,
    deletedAt: null,
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

export const documentVersionMetadataFixture = (
  overrides: Partial<DocumentVersionMetadataFixture> = {}
): DocumentVersionMetadataFixture => ({
  originalName: "aso-ana-souza.pdf",
  mimeType: "application/pdf",
  sizeBytes: 248_193,
  storageKey: "collaborators/66a64ab05bd7213b90d9b001/aso/v1.pdf",
  notes: "Documento ocupacional enviado",
  ...overrides
});

export const documentVersionFixture = (
  overrides: Partial<DocumentVersionFixture> = {}
): DocumentVersionFixture => ({
  version: 1,
  submittedAt: "2026-07-30T12:30:00.000Z",
  metadata: documentVersionMetadataFixture(),
  ...overrides
});

export const documentVersionGetFixture = (
  overrides: Partial<DocumentVersionFixture> = {}
): DocumentVersionFixture =>
  documentVersionFixture({
    version: 2,
    submittedAt: "2026-07-30T12:31:00.000Z",
    metadata: documentVersionMetadataFixture({
      originalName: "document-2.pdf",
      storageKey: "collaborators/66a64ab05bd7213b90d9b001/documents/v2.pdf",
      notes: "Document version 2"
    }),
    ...overrides
  });

export const documentVersionHistoryFixtures = (count: number): DocumentVersionFixture[] =>
  Array.from({length: count}, (_, index) => {
    const version = index + 1;
    return documentVersionFixture({
      version,
      submittedAt: new Date(Date.UTC(2026, 6, 30, 12, 30 + index)).toISOString(),
      metadata: documentVersionMetadataFixture({
        originalName: `document-${version}.pdf`,
        storageKey: `collaborators/66a64ab05bd7213b90d9b001/documents/v${version}.pdf`,
        notes: `Document version ${version}`
      })
    });
  });

export const documentVersionListPageFixture = (
  overrides: Partial<DocumentVersionListPageFixture> = {}
): DocumentVersionListPageFixture => ({
  items: documentVersionHistoryFixtures(3),
  currentVersion: 3,
  hasNext: false,
  ...overrides
});

export const validDocumentVersionBody = (
  overrides: Partial<DocumentVersionCreateBody["metadata"]> = {}
): DocumentVersionCreateBody => ({
  metadata: {
    ...documentVersionMetadataFixture(),
    ...overrides
  }
});

export const minimalDocumentVersionBody = (): DocumentVersionCreateBody => ({
  metadata: {originalName: "aso.pdf"}
});

export const nullDocumentVersionBody = (): DocumentVersionCreateBody => ({
  metadata: {
    originalName: "aso.pdf",
    mimeType: null,
    sizeBytes: null,
    storageKey: null,
    notes: null
  }
});

export const boundaryDocumentVersionBodies = {
  minimumOriginalName: validDocumentVersionBody({originalName: "a", sizeBytes: 0}),
  maximumFields: validDocumentVersionBody({
    originalName: "a".repeat(512),
    mimeType: "m".repeat(255),
    sizeBytes: 0,
    storageKey: "s".repeat(1024),
    notes: "n".repeat(4000)
  })
};

export const invalidDocumentVersionBodies = {
  missingMetadata: {},
  missingOriginalName: {metadata: {}},
  emptyOriginalName: validDocumentVersionBody({originalName: ""}),
  longOriginalName: validDocumentVersionBody({originalName: "a".repeat(513)}),
  nonTextOriginalName: {metadata: {...documentVersionMetadataFixture(), originalName: 42}},
  longMimeType: validDocumentVersionBody({mimeType: "m".repeat(256)}),
  nonTextMimeType: {metadata: {...documentVersionMetadataFixture(), mimeType: 42}},
  negativeSizeBytes: validDocumentVersionBody({sizeBytes: -1}),
  decimalSizeBytes: validDocumentVersionBody({sizeBytes: 1.5}),
  longStorageKey: validDocumentVersionBody({storageKey: "s".repeat(1025)}),
  nonTextStorageKey: {metadata: {...documentVersionMetadataFixture(), storageKey: 42}},
  longNotes: validDocumentVersionBody({notes: "n".repeat(4001)}),
  nonTextNotes: {metadata: {...documentVersionMetadataFixture(), notes: 42}},
  additionalBodyProperty: {...validDocumentVersionBody(), unexpected: true},
  additionalMetadataProperty: {
    metadata: {...documentVersionMetadataFixture(), unexpected: true}
  }
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

export const collaboratorDocumentPageFixtures = (
  count: number,
  overrides: Partial<CollaboratorDocumentFixture> = {}
): CollaboratorDocumentFixture[] =>
  Array.from({length: count}, (_, index) => {
    const id = (BigInt("0x66a64ab05bd7213b90d9d000") + BigInt(index + 1))
      .toString(16)
      .padStart(24, "0");
    const documentTypeId = (BigInt("0x66a64ab05bd7213b90d9e000") + BigInt(index + 1))
      .toString(16)
      .padStart(24, "0");
    return linkPendingFixture({
      id,
      documentTypeId,
      ...overrides
    });
  });
