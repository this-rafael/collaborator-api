export interface PendingDocumentFixture {
  id: string;
  status: "PENDING";
  linkedAt: string;
  collaborator: {
    id: string;
    name: string;
    cpf: string;
  };
  documentType: {
    id: string;
    name: string;
    code: string;
  };
  _links: Record<string, {href: string}>;
}

export interface PendingDocumentPageFixture {
  items: PendingDocumentFixture[];
  hasNext: boolean;
}

export interface CompletenessCountsFixture {
  totalActiveDocuments: number;
  submittedDocuments: number;
}

export interface CompletenessStatisticsFixture extends CompletenessCountsFixture {
  pendingDocuments: number;
  percentage: number;
  calculatedAt: string;
  _links: {
    self: {href: string};
    "pending-documents": {href: string};
    "pending-document-types": {href: string};
  };
}

export interface PendingDocumentTypeStatisticFixture {
  documentType: {
    id: string;
    name: string;
    code: string;
  };
  pendingCount: number;
  _links: Record<string, {href: string}>;
}

export interface PendingDocumentTypeStatisticsPageFixture {
  items: PendingDocumentTypeStatisticFixture[];
  hasNext: boolean;
}

export interface LatestSubmissionFixture {
  documentId: string;
  currentVersion: number;
  lastSubmittedAt: string;
  collaborator: {
    id: string;
    name: string;
    cpf: string;
  };
  documentType: {
    id: string;
    name: string;
    code: string;
  };
  _links: Record<string, {href: string}>;
}

export interface LatestSubmissionPageFixture {
  items: LatestSubmissionFixture[];
  hasNext: boolean;
}

export interface SubmissionEventFixture {
  documentId: string;
  version: number;
  submittedAt: string;
  metadata: {
    originalName: string;
    mimeType: string | null;
    sizeBytes: number | null;
    storageKey: string | null;
    notes: string | null;
  };
  _links: Record<string, {href: string}>;
}

export interface SubmissionEventPageFixture {
  items: SubmissionEventFixture[];
  hasNext: boolean;
}

export const pendingDocumentFixture = (
  overrides: Partial<PendingDocumentFixture> = {}
): PendingDocumentFixture => ({
  id: "66a64ab05bd7213b90d9c001",
  status: "PENDING",
  linkedAt: "2026-07-30T12:00:00.000Z",
  collaborator: {
    id: "66a64ab05bd7213b90d9b001",
    name: "Ana María Silva",
    cpf: "12345678909"
  },
  documentType: {
    id: "66a64ab05bd7213b90d9b010",
    name: "Atestado de Saúde Ocupacional",
    code: "ASO"
  },
  _links: {
    self: {href: "/api/v1/collaborator-documents/66a64ab05bd7213b90d9c001"},
    collaborator: {href: "/api/v1/collaborators/66a64ab05bd7213b90d9b001"},
    documentType: {href: "/api/v1/document-types/66a64ab05bd7213b90d9b010"}
  },
  ...overrides
});

export const pendingDocumentPageFixtures = (count: number): PendingDocumentFixture[] =>
  Array.from({length: count}, (_, index) => {
    const id = hexadecimalId("66a64ab05bd7213b90d9d000", index + 1);
    const documentTypeId = hexadecimalId("66a64ab05bd7213b90d9e000", index + 1);
    return pendingDocumentFixture({
      id,
      documentType: {
        id: documentTypeId,
        name: `Tipo ${String(index + 1).padStart(3, "0")}`,
        code: `TYPE_${String(index + 1).padStart(3, "0")}`
      },
      _links: {
        self: {href: `/api/v1/collaborator-documents/${id}`},
        collaborator: {href: "/api/v1/collaborators/66a64ab05bd7213b90d9b001"},
        documentType: {href: `/api/v1/document-types/${documentTypeId}`}
      }
    });
  });

export const completenessCountsFixture = (
  overrides: Partial<CompletenessCountsFixture> = {}
): CompletenessCountsFixture => ({
  totalActiveDocuments: 4,
  submittedDocuments: 3,
  ...overrides
});

export const completenessStatisticsFixture = (
  overrides: Partial<CompletenessStatisticsFixture> = {}
): CompletenessStatisticsFixture => ({
  totalActiveDocuments: 4,
  submittedDocuments: 3,
  pendingDocuments: 1,
  percentage: 75,
  calculatedAt: "2026-07-31T12:00:00.000Z",
  _links: {
    self: {href: "/api/v1/statistics/completeness"},
    "pending-documents": {href: "/api/v1/pending-documents"},
    "pending-document-types": {href: "/api/v1/statistics/pending-document-types"}
  },
  ...overrides
});

export const pendingDocumentTypeStatisticFixture = (
  overrides: Partial<PendingDocumentTypeStatisticFixture> = {}
): PendingDocumentTypeStatisticFixture => ({
  documentType: {
    id: "66a64ab05bd7213b90d9b010",
    name: "Atestado de Saúde Ocupacional",
    code: "ASO"
  },
  pendingCount: 3,
  _links: {
    self: {href: "/api/v1/document-types/66a64ab05bd7213b90d9b010"}
  },
  ...overrides
});

export const pendingDocumentTypeStatisticFixtures = (
  count: number
): PendingDocumentTypeStatisticFixture[] =>
  Array.from({length: count}, (_, index) => {
    const documentTypeId = hexadecimalId("66a64ab05bd7213b90d9e000", index + 1);
    return pendingDocumentTypeStatisticFixture({
      documentType: {
        id: documentTypeId,
        name: `Tipo ${String(index + 1).padStart(3, "0")}`,
        code: `TYPE_${String(index + 1).padStart(3, "0")}`
      },
      pendingCount: count - index,
      _links: {self: {href: `/api/v1/document-types/${documentTypeId}`}}
    });
  });

export const latestSubmissionFixture = (
  overrides: Partial<LatestSubmissionFixture> = {}
): LatestSubmissionFixture => ({
  documentId: "66a64ab05bd7213b90d9c001",
  currentVersion: 2,
  lastSubmittedAt: "2026-07-31T15:00:00.000Z",
  collaborator: {
    id: "66a64ab05bd7213b90d9b001",
    name: "Ana María Silva",
    cpf: "12345678909"
  },
  documentType: {
    id: "66a64ab05bd7213b90d9b010",
    name: "Atestado de Saúde Ocupacional",
    code: "ASO"
  },
  _links: {
    self: {href: "/api/v1/collaborator-documents/66a64ab05bd7213b90d9c001"},
    collaborator: {href: "/api/v1/collaborators/66a64ab05bd7213b90d9b001"},
    documentType: {href: "/api/v1/document-types/66a64ab05bd7213b90d9b010"}
  },
  ...overrides
});

export const latestSubmissionPageFixtures = (count: number): LatestSubmissionFixture[] =>
  Array.from({length: count}, (_, index) => {
    const documentId = hexadecimalId("66a64ab05bd7213b90d9d000", index + 1);
    const documentTypeId = hexadecimalId("66a64ab05bd7213b90d9e000", index + 1);
    const lastSubmittedAt = new Date(
      Date.parse("2026-07-31T15:00:00.000Z") - index * 60_000
    ).toISOString();
    return latestSubmissionFixture({
      documentId,
      currentVersion: index + 1,
      lastSubmittedAt,
      documentType: {
        id: documentTypeId,
        name: `Tipo ${String(index + 1).padStart(3, "0")}`,
        code: `TYPE_${String(index + 1).padStart(3, "0")}`
      },
      _links: {
        self: {href: `/api/v1/collaborator-documents/${documentId}`},
        collaborator: {href: "/api/v1/collaborators/66a64ab05bd7213b90d9b001"},
        documentType: {href: `/api/v1/document-types/${documentTypeId}`}
      }
    });
  });

export const submissionEventFixture = (
  overrides: Partial<SubmissionEventFixture> = {}
): SubmissionEventFixture => ({
  documentId: "66a64ab05bd7213b90d9c001",
  version: 2,
  submittedAt: "2026-07-31T15:00:00.000Z",
  metadata: {
    originalName: "document-v2.pdf",
    mimeType: "application/pdf",
    sizeBytes: 2048,
    storageKey: "documents/66a64ab05bd7213b90d9c001/v2",
    notes: "Second submission"
  },
  _links: {
    self: {href: "/api/v1/collaborator-documents/66a64ab05bd7213b90d9c001/versions/2"},
    document: {href: "/api/v1/collaborator-documents/66a64ab05bd7213b90d9c001"}
  },
  ...overrides
});

export const submissionEventPageFixtures = (count: number): SubmissionEventFixture[] =>
  Array.from({length: count}, (_, index) => {
    const documentId = hexadecimalId("66a64ab05bd7213b90d9d000", index + 1);
    const version = 1;
    const submittedAt = new Date(
      Date.parse("2026-07-31T15:00:00.000Z") - index * 60_000
    ).toISOString();
    return submissionEventFixture({
      documentId,
      version,
      submittedAt,
      metadata: {
        originalName: `document-v${version}.pdf`,
        mimeType: "application/pdf",
        sizeBytes: 1024 + index,
        storageKey: `documents/${documentId}/v${version}`,
        notes: null
      },
      _links: {
        self: {href: `/api/v1/collaborator-documents/${documentId}/versions/${version}`},
        document: {href: `/api/v1/collaborator-documents/${documentId}`}
      }
    });
  });

function hexadecimalId(base: string, offset: number): string {
  return (BigInt(`0x${base}`) + BigInt(offset)).toString(16).padStart(24, "0");
}
