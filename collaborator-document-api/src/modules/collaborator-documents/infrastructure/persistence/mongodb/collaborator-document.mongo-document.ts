import {Schema, type Connection, type Model} from "mongoose";

/** Documento Mongo persistido pelo módulo collaborator-documents. */
export type CollaboratorDocumentMongoDocument = {
  collaboratorId: string;
  documentTypeId: string;
  status: "PENDING" | "SUBMITTED";
  currentVersion: number;
  versions: unknown[];
  lastSubmittedAt: Date | null;
  linkedAt: Date;
  unlinkedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

/** Esquema Mongoose para a coleção de vínculos. */
export const collaboratorDocumentMongoSchema = new Schema<CollaboratorDocumentMongoDocument>(
  {
    collaboratorId: {type: String, required: true},
    documentTypeId: {type: String, required: true},
    status: {type: String, required: true, enum: ["PENDING", "SUBMITTED"]},
    currentVersion: {type: Number, required: true},
    versions: {type: [Schema.Types.Mixed], default: []},
    lastSubmittedAt: {type: Date, default: null},
    linkedAt: {type: Date, required: true},
    unlinkedAt: {type: Date, default: null},
    createdAt: {type: Date, required: true},
    updatedAt: {type: Date, required: true},
    deletedAt: {type: Date, default: null}
  },
  {collection: "collaborator_documents", timestamps: false}
);

/** Obtém o model da conexão injetada. */
export const getCollaboratorDocumentMongoModel = (
  connection: Connection
): Model<CollaboratorDocumentMongoDocument> =>
  (connection.models.CollaboratorDocument as
    Model<CollaboratorDocumentMongoDocument> | undefined) ??
  connection.model<CollaboratorDocumentMongoDocument>(
    "CollaboratorDocument",
    collaboratorDocumentMongoSchema
  );
