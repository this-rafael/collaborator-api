import {Injectable} from "@tsed/di";
import {MongooseService} from "@tsed/mongoose";
import type {IndexDescription} from "mongodb";
import {err, ok, type Result} from "neverthrow";

import {
  collaboratorApplicationFailure,
  type CollaboratorFailure
} from "../../../domain/errors/collaborator.failure.js";
import {getCollaboratorMongoModel} from "./collaborator.mongo-document.js";

/** Índices do módulo: unicidade apenas entre colaboradores ainda ativos. */
export const collaboratorIndexes: readonly IndexDescription[] = [
  {
    key: {cpf: 1},
    name: "collaborators_active_cpf_unique",
    unique: true,
    partialFilterExpression: {deletedAt: null}
  },
  {
    key: {email: 1},
    name: "collaborators_active_email_unique",
    unique: true,
    partialFilterExpression: {deletedAt: null}
  },
  {
    key: {deletedAt: 1, _id: 1},
    name: "collaborators_active_keyset",
    partialFilterExpression: {deletedAt: null}
  }
];

/** Provisionador injetável para o composition root aplicar no startup. */
@Injectable()
export class CollaboratorIndexProvisioner {
  constructor(private readonly mongoose: MongooseService) {}

  ensure(): Promise<Result<readonly string[], CollaboratorFailure>> {
    return this.ensureSafely();
  }

  private async ensureSafely(): Promise<Result<readonly string[], CollaboratorFailure>> {
    try {
      const connection = this.mongoose.get();
      if (!connection || connection.readyState !== 1) {
        return err(
          collaboratorApplicationFailure(
            "SERVICE_UNAVAILABLE",
            "Collaborator persistence is unavailable."
          )
        );
      }
      const names = await getCollaboratorMongoModel(connection).collection.createIndexes([
        ...collaboratorIndexes
      ]);
      return ok(names);
    } catch {
      return err(
        collaboratorApplicationFailure(
          "INTERNAL_SERVER_ERROR",
          "Collaborator indexes could not be created."
        )
      );
    }
  }
}

/** Forma funcional útil para bootstrap e testes sem expor conexão global. */
export const ensureCollaboratorIndexes = (
  mongoose: MongooseService
): Promise<Result<readonly string[], CollaboratorFailure>> =>
  new CollaboratorIndexProvisioner(mongoose).ensure();
