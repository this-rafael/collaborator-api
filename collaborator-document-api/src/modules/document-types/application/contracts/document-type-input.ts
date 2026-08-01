/**
 * Contratos de entrada (primitivos) dos casos de uso de tipos de documento.
 * Isolam a camada de aplicação de detalhes de transporte (HTTP) e persistência.
 */
/** Dados primitivos aceitos para criar um tipo de documento. */
export type CreateDocumentTypeInput = Readonly<{
  /** Nome candidato do tipo de documento. */
  name: unknown;
  /** Código candidato do tipo de documento. */
  code: unknown;
  /** Descrição candidata opcional. */
  description?: unknown;
}>;

/** Dados primitivos aceitos para atualizar um tipo de documento. */
export type UpdateDocumentTypeInput = Readonly<{
  /** Identificador do tipo de documento a atualizar. */
  id: string;
  /** Conjunto parcial de campos a alterar. */
  patch: Readonly<Record<string, unknown>>;
}>;

/** Identificador do tipo de documento usado por consultas e exclusão. */
export type DocumentTypeIdInput = Readonly<{
  /** Identificador do tipo de documento. */
  id: string;
}>;

/** Filtros de listagem já livres de detalhes HTTP. */
export type DocumentTypeListFiltersInput = Readonly<{
  /** Filtro opcional por nome. */
  name?: string;
  /** Filtro opcional por código. */
  code?: string;
}>;

/** Entrada de paginação keyset para a listagem. */
export type ListDocumentTypesInput = Readonly<{
  /** Filtros aplicados à listagem. */
  filters: DocumentTypeListFiltersInput;
  /** Quantidade máxima de itens por página. */
  limit: number;
  /** Cursor opcional: retorna itens após este identificador. */
  afterId?: string;
}>;
