/**
 * Mapeamento entre o agregado de colaborador e os documentos MongoDB.
 *
 * Isola os detalhes do driver, revalidando os dados na leitura para que estados
 * inválidos na persistência não atravessem para o domínio.
 */
import {err, ok, type Result} from "neverthrow";
import {Types} from "mongoose";

import {Collaborator} from "../../../domain/entities/collaborator.js";
import {
  collaboratorApplicationFailure,
  type CollaboratorFailure
} from "../../../domain/errors/collaborator.failure.js";
import {Cpf} from "../../../domain/value-objects/cpf.js";
import {Email} from "../../../domain/value-objects/email.js";
import {CollaboratorName} from "../../../domain/value-objects/collaborator-name.js";
import type {CollaboratorMongoDocument} from "./collaborator.mongo-document.js";

/** Documento pronto para inserção/atualização na coleção MongoDB. */
export type CollaboratorMongoWrite = CollaboratorMongoDocument & Readonly<{_id: Types.ObjectId}>;

/** Linha lean aceita pelo mapper de leitura. */
export type CollaboratorMongoRead = Partial<CollaboratorMongoDocument> &
  Readonly<{_id?: {toString(): string}; id?: string}>;

/**
 * Normaliza nome para busca case/diacritic-insensitive.
 *
 * @param value - Nome original do colaborador.
 * @returns Nome sem acentos e em minúsculas (locale pt-BR), usado no campo indexado de busca.
 */
export const normalizeCollaboratorName = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR");

/**
 * Converte agregado em documento de escrita, sem deixar detalhes Mongo no domínio.
 *
 * @param collaborator - Agregado a ser projetado para gravação.
 * @returns Result com o `CollaboratorMongoWrite` pronto para inserção/atualização
 * em sucesso; em falha, `CollaboratorFailure` com código `INTERNAL_SERVER_ERROR`
 * quando o id gerado não é um ObjectId válido.
 */
export const collaboratorToMongoDocument = (
  collaborator: Collaborator
): Result<CollaboratorMongoWrite, CollaboratorFailure> => {
  const {id, name, cpf, email, createdAt, updatedAt, deletedAt} = collaborator.props;
  if (!Types.ObjectId.isValid(id)) {
    return err(
      collaboratorApplicationFailure(
        "INTERNAL_SERVER_ERROR",
        "Generated collaborator id is invalid."
      )
    );
  }

  return ok({
    _id: new Types.ObjectId(id),
    name: name.value,
    nameNormalized: normalizeCollaboratorName(name.value),
    cpf: cpf.value,
    email: email.value,
    createdAt,
    updatedAt,
    deletedAt
  });
};

/**
 * Reconstitui o agregado validando novamente dados recebidos da persistência.
 *
 * @param value - Linha lean lida da coleção MongoDB.
 * @returns Result com o `Collaborator` reconstituído em sucesso; em falha,
 * `CollaboratorFailure` com código `INTERNAL_SERVER_ERROR` quando os dados
 * persistidos são inconsistentes ou não satisfazem as invariantes do domínio.
 */
export const collaboratorFromMongoDocument = (
  value: CollaboratorMongoRead
): Result<Collaborator, CollaboratorFailure> => {
  const id = value._id?.toString() ?? value.id;
  if (
    !id ||
    typeof value.name !== "string" ||
    typeof value.cpf !== "string" ||
    typeof value.email !== "string" ||
    !(value.createdAt instanceof Date) ||
    !(value.updatedAt instanceof Date) ||
    (value.deletedAt !== null &&
      value.deletedAt !== undefined &&
      !(value.deletedAt instanceof Date))
  ) {
    return err(
      collaboratorApplicationFailure(
        "INTERNAL_SERVER_ERROR",
        "Collaborator persistence data is invalid."
      )
    );
  }

  const name = CollaboratorName.create(value.name);
  const cpf = Cpf.create(value.cpf);
  const email = Email.create(value.email);
  if (name.isErr() || cpf.isErr() || email.isErr()) {
    return err(
      collaboratorApplicationFailure(
        "INTERNAL_SERVER_ERROR",
        "Collaborator persistence data is invalid."
      )
    );
  }

  return Collaborator.reconstitute({
    id,
    name: name.value,
    cpf: cpf.value,
    email: email.value,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    deletedAt: value.deletedAt ?? null
  }).mapErr(() =>
    collaboratorApplicationFailure(
      "INTERNAL_SERVER_ERROR",
      "Collaborator persistence data is invalid."
    )
  );
};
