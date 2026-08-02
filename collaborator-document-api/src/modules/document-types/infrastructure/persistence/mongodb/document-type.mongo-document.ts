import {Schema, type Connection, type Model} from "mongoose";

/** Documento Mongo persistido pelo módulo document-types. */
export type DocumentTypeMongoDocument = {
  /** Nome exibível do tipo de documento. */
  name: string;
  /** Nome normalizado (sem acentos, minúsculas) usado para busca e ordenação. */
  nameNormalized: string;
  /** Código estável e único entre os tipos ativos. */
  code: string;
  /** Descrição, ou `null` quando ausente. */
  description: string | null;
  /** Instante de criação. */
  createdAt: Date;
  /** Instante da última atualização. */
  updatedAt: Date;
  /** Instante do soft delete; `null` enquanto ativo. */
  deletedAt: Date | null;
  /** Cerca interna para serializar criação de vínculos com exclusões lógicas. */
  documentLinkFence?: number;
};

/** Esquema Mongoose para a coleção de tipos de documento. */
export const documentTypeMongoSchema = new Schema<DocumentTypeMongoDocument>(
  {
    name: {type: String, required: true},
    nameNormalized: {type: String, required: true},
    code: {type: String, required: true},
    description: {type: String, default: null},
    createdAt: {type: Date, required: true},
    updatedAt: {type: Date, required: true},
    deletedAt: {type: Date, default: null},
    documentLinkFence: {type: Number, default: 0, select: false}
  },
  {collection: "document_types", timestamps: false}
);

/**
 * Obtém (ou registra sob demanda) o model Mongoose de tipos de documento a
 * partir da conexão injetada pela composição da aplicação.
 *
 * @param connection - Conexão Mongoose ativa.
 * @returns Model Mongoose para a coleção `document_types`.
 */
export const getDocumentTypeMongoModel = (
  connection: Connection
): Model<DocumentTypeMongoDocument> =>
  (connection.models.DocumentType as Model<DocumentTypeMongoDocument> | undefined) ??
  connection.model<DocumentTypeMongoDocument>("DocumentType", documentTypeMongoSchema);
