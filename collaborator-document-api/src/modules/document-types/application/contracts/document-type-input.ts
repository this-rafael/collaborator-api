/** Dados primitivos aceitos para criar um tipo de documento. */
export type CreateDocumentTypeInput = Readonly<{
  name: unknown;
  code: unknown;
  description?: unknown;
}>;

/** Dados primitivos aceitos para atualizar um tipo de documento. */
export type UpdateDocumentTypeInput = Readonly<{
  id: string;
  patch: Readonly<Record<string, unknown>>;
}>;

/** Identificador do tipo de documento usado por consultas e exclusão. */
export type DocumentTypeIdInput = Readonly<{id: string}>;

/** Filtros de listagem já livres de detalhes HTTP. */
export type DocumentTypeListFiltersInput = Readonly<{
  name?: string;
  code?: string;
}>;

/** Entrada de paginação keyset para a listagem. */
export type ListDocumentTypesInput = Readonly<{
  filters: DocumentTypeListFiltersInput;
  limit: number;
  afterId?: string;
}>;
