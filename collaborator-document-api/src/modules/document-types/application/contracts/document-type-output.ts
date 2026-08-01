/**
 * Contratos de saída (primitivos) dos casos de uso de tipos de documento e o
 * mapeador do agregado de domínio para a fronteira da aplicação.
 */
import type {DocumentType} from "../../domain/entities/document-type.js";

/** Representação primitiva de um tipo de documento na fronteira da aplicação. */
export type DocumentTypeOutput = Readonly<{
  /** Identificador único do tipo de documento. */
  id: string;
  /** Nome do tipo de documento. */
  name: string;
  /** Código estável do tipo de documento. */
  code: string;
  /** Descrição, ou `null` quando ausente. */
  description: string | null;
  /** Data de criação em formato ISO 8601. */
  createdAt: string;
  /** Data da última atualização em formato ISO 8601. */
  updatedAt: string;
  /** Data do soft delete em formato ISO 8601, ou `null` quando ativo. */
  deletedAt: string | null;
}>;

/** Página primitiva de tipos de documento ativos. */
export type ListDocumentTypesOutput = Readonly<{
  /** Itens da página atual. */
  items: readonly DocumentTypeOutput[];
  /** Indica se há uma próxima página. */
  hasNext: boolean;
  /** Filtros efetivamente aplicados à listagem. */
  filters: Readonly<{name?: string; code?: string}>;
}>;

/**
 * Converte o agregado de tipo de documento em sua representação primitiva,
 * evitando que Value Objects atravessem a fronteira da aplicação.
 *
 * @param documentType - Agregado de tipo de documento a ser convertido.
 * @returns Representação `DocumentTypeOutput` imutável, com datas em ISO 8601.
 */
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
