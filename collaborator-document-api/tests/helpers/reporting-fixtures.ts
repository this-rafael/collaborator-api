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

function hexadecimalId(base: string, offset: number): string {
  return (BigInt(`0x${base}`) + BigInt(offset)).toString(16).padStart(24, "0");
}
