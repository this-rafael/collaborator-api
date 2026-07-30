/** Dados primitivos aceitos para criar um colaborador. */
export type CreateCollaboratorInput = Readonly<{
  name: unknown;
  cpf: unknown;
  email: unknown;
}>;

/** Dados primitivos aceitos para atualizar um colaborador. */
export type UpdateCollaboratorInput = Readonly<{
  id: string;
  patch: Readonly<Record<string, unknown>>;
}>;

/** Identificador do colaborador usado por consultas e exclusão. */
export type CollaboratorIdInput = Readonly<{id: string}>;

/** Filtros de listagem já livres de detalhes HTTP. */
export type CollaboratorListFiltersInput = Readonly<{
  name?: string;
  cpf?: string;
  email?: string;
}>;

/** Entrada de paginação keyset para a listagem. */
export type ListCollaboratorsInput = Readonly<{
  filters: CollaboratorListFiltersInput;
  limit: number;
  afterId?: string;
}>;
