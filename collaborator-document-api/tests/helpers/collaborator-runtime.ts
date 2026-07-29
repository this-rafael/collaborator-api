import {err, ok, type Result} from "neverthrow";

import {Collaborator} from "../../src/modules/collaborators/domain/collaborator.js";

export type CollaboratorRuntimeFailure =
  | "COLLABORATOR_NOT_FOUND"
  | "DUPLICATE_ACTIVE_CPF"
  | "DUPLICATE_ACTIVE_EMAIL"
  | "COLLABORATOR_DELETED"
  | "SERVICE_UNAVAILABLE";

export class CollaboratorRepositoryStub {
  constructor(
    private readonly result: Result<Collaborator, CollaboratorRuntimeFailure> = ok(
      Collaborator.reconstitute({
        id: "66a64ab05bd7213b90d9b001",
        name: Collaborator.create({
          name: "Ana Silva",
          cpf: "12345678909",
          email: "ana@example.com"
        })._unsafeUnwrap().props.name,
        cpf: Collaborator.create({
          name: "Ana Silva",
          cpf: "12345678909",
          email: "ana@example.com"
        })._unsafeUnwrap().props.cpf,
        email: Collaborator.create({
          name: "Ana Silva",
          cpf: "12345678909",
          email: "ana@example.com"
        })._unsafeUnwrap().props.email,
        createdAt: new Date("2026-07-29T12:00:00.000Z"),
        updatedAt: new Date("2026-07-29T12:00:00.000Z"),
        deletedAt: null
      })
    )
  ) {}

  async create(): Promise<Result<Collaborator, CollaboratorRuntimeFailure>> {
    return this.result;
  }

  async findById(): Promise<Result<Collaborator, CollaboratorRuntimeFailure>> {
    return this.result;
  }

  async updateActive(): Promise<Result<Collaborator, CollaboratorRuntimeFailure>> {
    return this.result;
  }

  async listActive(): Promise<
    Result<{items: readonly Collaborator[]; hasNext: boolean}, CollaboratorRuntimeFailure>
  > {
    return this.result.map((value) => ({
      items: value.deletedAt === null ? [value] : [],
      hasNext: false
    }));
  }

  static unavailable(): CollaboratorRepositoryStub {
    return new CollaboratorRepositoryStub(err("SERVICE_UNAVAILABLE"));
  }

  static notFound(): CollaboratorRepositoryStub {
    return new CollaboratorRepositoryStub(err("COLLABORATOR_NOT_FOUND"));
  }

  static duplicateCpf(): CollaboratorRepositoryStub {
    return new CollaboratorRepositoryStub(err("DUPLICATE_ACTIVE_CPF"));
  }

  static duplicateEmail(): CollaboratorRepositoryStub {
    return new CollaboratorRepositoryStub(err("DUPLICATE_ACTIVE_EMAIL"));
  }
}
