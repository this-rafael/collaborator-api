export interface CollaboratorFixture {
  id: string;
  name: string;
  cpf: string;
  email: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export const activeCollaboratorFixture = (
  overrides: Partial<CollaboratorFixture> = {}
): CollaboratorFixture => ({
  id: "66a64ab05bd7213b90d9b001",
  name: "Ana Silva",
  cpf: "12345678909",
  email: "ana@example.com",
  createdAt: "2026-07-29T12:00:00.000Z",
  updatedAt: "2026-07-29T12:00:00.000Z",
  deletedAt: null,
  ...overrides
});

export const deletedCollaboratorFixture = (
  overrides: Partial<CollaboratorFixture> = {}
): CollaboratorFixture =>
  activeCollaboratorFixture({
    id: "66a64ab05bd7213b90d9b002",
    deletedAt: "2026-07-29T13:00:00.000Z",
    ...overrides
  });

export const validCollaboratorBody = (
  overrides: Partial<Record<"name" | "cpf" | "email", unknown>> = {}
) => ({
  name: "Ana Silva",
  cpf: "12345678909",
  email: "ana@example.com",
  ...overrides
});

export const invalidCollaboratorBodies = {
  missingName: {cpf: "12345678909", email: "ana@example.com"},
  missingCpf: {name: "Ana Silva", email: "ana@example.com"},
  missingEmail: {name: "Ana Silva", cpf: "12345678909"},
  emptyName: validCollaboratorBody({name: ""}),
  longName: validCollaboratorBody({name: "a".repeat(201)}),
  formattedCpf: validCollaboratorBody({cpf: "123.456.789-09"}),
  invalidEmail: validCollaboratorBody({email: "invalid"}),
  extraProperty: {...validCollaboratorBody(), unexpected: true}
};
