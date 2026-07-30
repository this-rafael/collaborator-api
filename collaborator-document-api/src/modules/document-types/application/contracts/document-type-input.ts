export type CreateDocumentTypeInput = Readonly<{
  name: unknown;
  code: unknown;
  description?: unknown;
}>;

export type UpdateDocumentTypeInput = Readonly<{
  id: string;
  patch: Readonly<Record<string, unknown>>;
}>;

export type DocumentTypeIdInput = Readonly<{id: string}>;

export type DocumentTypeListFiltersInput = Readonly<{
  name?: string;
  code?: string | unknown;
}>;

export type ListDocumentTypesInput = Readonly<{
  filters: DocumentTypeListFiltersInput;
  limit: number;
  afterId?: string;
}>;
