import {Schema, type Connection, type Model} from "mongoose";

export type DocumentTypeMongoDocument = {
  name: string;
  nameNormalized: string;
  code: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

export const documentTypeMongoSchema = new Schema<DocumentTypeMongoDocument>(
  {
    name: {type: String, required: true},
    nameNormalized: {type: String, required: true},
    code: {type: String, required: true},
    description: {type: String, default: null},
    createdAt: {type: Date, required: true},
    updatedAt: {type: Date, required: true},
    deletedAt: {type: Date, default: null}
  },
  {collection: "document_types", timestamps: false}
);

export const getDocumentTypeMongoModel = (
  connection: Connection
): Model<DocumentTypeMongoDocument> =>
  (connection.models.DocumentType as Model<DocumentTypeMongoDocument> | undefined) ??
  connection.model<DocumentTypeMongoDocument>("DocumentType", documentTypeMongoSchema);
