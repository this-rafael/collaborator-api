import {errAsync, okAsync, type ResultAsync} from "neverthrow";

import {Collaborator} from "../../src/modules/collaborators/domain/entities/collaborator.js";
import type {
  CollaboratorListPage,
  CollaboratorRepository
} from "../../src/modules/collaborators/domain/repositories/collaborator.repository.js";
import type {CollaboratorFailure} from "../../src/modules/collaborators/domain/errors/collaborator.failure.js";

export type CollaboratorRuntimeFailure = CollaboratorFailure;

const fixedCollaborator = (): Collaborator =>
  Collaborator.create(
    {
      id: "66a64ab05bd7213b90d9b001",
      name: "Ana Silva",
      cpf: "12345678909",
      email: "ana@example.com"
    },
    new Date("2026-07-29T12:00:00.000Z")
  )._unsafeUnwrap();

export class CollaboratorRepositoryStub implements CollaboratorRepository {
  constructor(
    private readonly result: ResultAsync<Collaborator, CollaboratorRuntimeFailure> = okAsync(
      fixedCollaborator()
    )
  ) {}

  create(): ResultAsync<Collaborator, CollaboratorRuntimeFailure> {
    return this.result;
  }

  findById(): ResultAsync<Collaborator, CollaboratorRuntimeFailure> {
    return this.result;
  }

  updateActive(): ResultAsync<Collaborator, CollaboratorRuntimeFailure> {
    return this.result;
  }

  listActive(): ResultAsync<CollaboratorListPage, CollaboratorRuntimeFailure> {
    return this.result.map((value) => ({
      items: value.deletedAt === null ? [value] : [],
      hasNext: false
    }));
  }

  softDeleteActive(): ResultAsync<boolean, CollaboratorRuntimeFailure> {
    return okAsync(true);
  }

  static unavailable(): CollaboratorRepositoryStub {
    return new CollaboratorRepositoryStub(
      errAsync({
        kind: "application",
        code: "SERVICE_UNAVAILABLE",
        message: "Collaborator persistence is unavailable."
      })
    );
  }

  static notFound(): CollaboratorRepositoryStub {
    return new CollaboratorRepositoryStub(
      errAsync({kind: "application", code: "COLLABORATOR_NOT_FOUND", message: "Not found."})
    );
  }

  static duplicateCpf(): CollaboratorRepositoryStub {
    return new CollaboratorRepositoryStub(
      errAsync({kind: "application", code: "DUPLICATE_ACTIVE_CPF", message: "Duplicate CPF."})
    );
  }

  static duplicateEmail(): CollaboratorRepositoryStub {
    return new CollaboratorRepositoryStub(
      errAsync({
        kind: "application",
        code: "DUPLICATE_ACTIVE_EMAIL",
        message: "Duplicate email."
      })
    );
  }
}
