/** Parâmetros de consulta para listagem de tipos de documento. */
export type ListDocumentTypesQueryDto = Readonly<{
  name?: string;
  code?: string;
  limit?: string;
  cursor?: string;
}>;
