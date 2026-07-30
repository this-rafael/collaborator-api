export interface DocumentTypeFixture {
  id: string;
  name: string;
  code: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export const activeDocumentTypeFixture = (
  overrides: Partial<DocumentTypeFixture> = {}
): DocumentTypeFixture => ({
  id: "66a64ab05bd7213b90d9b010",
  name: "Atestado de Saúde Ocupacional",
  code: "ASO",
  description: "Atestado ocupacional vigente",
  createdAt: "2026-07-30T12:00:00.000Z",
  updatedAt: "2026-07-30T12:00:00.000Z",
  deletedAt: null,
  ...overrides
});

export const deletedDocumentTypeFixture = (
  overrides: Partial<DocumentTypeFixture> = {}
): DocumentTypeFixture =>
  activeDocumentTypeFixture({
    id: "66a64ab05bd7213b90d9b011",
    name: "Atestado histórico",
    deletedAt: "2026-07-30T13:00:00.000Z",
    ...overrides
  });

export const validDocumentTypeBody = (
  overrides: Partial<Record<"name" | "code" | "description", unknown>> = {}
) => ({
  name: "Atestado de Saúde Ocupacional",
  code: "ASO",
  description: "Atestado ocupacional vigente",
  ...overrides
});

export const invalidDocumentTypeBodies = {
  missingName: {code: "ASO", description: null},
  missingCode: {name: "Atestado de Saúde Ocupacional", description: null},
  emptyName: validDocumentTypeBody({name: ""}),
  longName: validDocumentTypeBody({name: "a".repeat(201)}),
  nonTextName: validDocumentTypeBody({name: 42}),
  shortCode: validDocumentTypeBody({code: "A"}),
  longCode: validDocumentTypeBody({code: `A${"B".repeat(64)}`}),
  numericInitialCode: validDocumentTypeBody({code: "1ASO"}),
  lowercaseCode: validDocumentTypeBody({code: "aso"}),
  spacedCode: validDocumentTypeBody({code: "ATESTADO SAUDE"}),
  hyphenatedCode: validDocumentTypeBody({code: "ATESTADO-SAUDE"}),
  nonTextCode: validDocumentTypeBody({code: 42}),
  longDescription: validDocumentTypeBody({description: "a".repeat(1001)}),
  nonTextDescription: validDocumentTypeBody({description: {text: "invalid"}}),
  extraProperty: {...validDocumentTypeBody(), unexpected: true}
};

export const documentTypePageFixtures = (count: number): DocumentTypeFixture[] =>
  Array.from({length: count}, (_, index) =>
    activeDocumentTypeFixture({
      id: (BigInt("0x66a64ab05bd7213b90d9c000") + BigInt(index + 1)).toString(16).padStart(24, "0"),
      name: `Tipo ${String(index + 1).padStart(3, "0")}`,
      code: `TYPE_${String(index + 1).padStart(3, "0")}`
    })
  );
