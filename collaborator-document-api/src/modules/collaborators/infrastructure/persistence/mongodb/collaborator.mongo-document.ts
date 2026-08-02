import {Schema, type Connection, type Model} from "mongoose";

/** Documento Mongo persistido pelo módulo collaborators. */
export type CollaboratorMongoDocument = {
  name: string;
  nameNormalized: string;
  cpf: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  documentLinkFence?: number;
};

/** Esquema Mongoose para a coleção de colaboradores. */
export const collaboratorMongoSchema = new Schema<CollaboratorMongoDocument>(
  {
    name: {type: String, required: true},
    nameNormalized: {type: String, required: true},
    cpf: {type: String, required: true},
    email: {type: String, required: true},
    createdAt: {type: Date, required: true},
    updatedAt: {type: Date, required: true},
    deletedAt: {type: Date, default: null},
    documentLinkFence: {type: Number, default: 0, select: false}
  },
  {collection: "collaborators", timestamps: false}
);

/** Obtém o model da conexão que foi injetada pela composição da aplicação. */
export const getCollaboratorMongoModel = (
  connection: Connection
): Model<CollaboratorMongoDocument> =>
  (connection.models.Collaborator as Model<CollaboratorMongoDocument> | undefined) ??
  connection.model<CollaboratorMongoDocument>("Collaborator", collaboratorMongoSchema);
