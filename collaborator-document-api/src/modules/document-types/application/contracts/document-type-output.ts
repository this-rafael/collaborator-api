import type {DocumentType} from "../../domain/entities/document-type.js";

/** Representação primitiva de um tipo de documento na fronteira da aplicação. */
export type DocumentTypeOutput = Readonly<{
  id: string;
  name: string;
  code: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}>;

/** Página primitiva de tipos de documento ativos. */
export type ListDocumentTypesOutput = Readonly<{
  items: readonly DocumentTypeOutput[];
  hasNext: boolean;
  filters: Readonly<{name?: string; code?: string}>;
}>;

/** Converte o agregado sem deixar Value Objects atravessarem a aplicação. */
export const documentTypeToOutput = (documentType: DocumentType): DocumentTypeOutput => {
  const {id, name, code, description, createdAt, updatedAt, deletedAt} = documentType.props;
  return Object.freeze({
    id,
    name: name.value,
    code: code.value,
    description,
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
    deletedAt: deletedAt?.toISOString() ?? null
  });
};
