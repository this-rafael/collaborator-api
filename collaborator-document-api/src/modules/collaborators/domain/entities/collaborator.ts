/**
 * Aggregate root de colaborador e seus contratos de estado.
 *
 * Reúne o estado imutável, as regras de transição (criação, atualização e soft
 * delete) e a reconstituição a partir da persistência. Todas as regras de
 * negócio esperadas são sinalizadas via `Result`, nunca por exceções.
 */
import {err, ok, type Result} from "neverthrow";

import {collaboratorAlreadyDeletedFailure} from "../errors/collaborator-already-deleted.failure.js";
import {
  collaboratorDomainFailure,
  type CollaboratorDomainFailure
} from "../errors/collaborator.failure.js";
import {Cpf} from "../value-objects/cpf.js";
import {Email} from "../value-objects/email.js";
import {CollaboratorName} from "../value-objects/collaborator-name.js";

/** Estado imutável do agregado de colaborador. */
export type CollaboratorProps = Readonly<{
  id: string;
  name: CollaboratorName;
  cpf: Cpf;
  email: Email;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}>;

/** Dados brutos aceitos para criar um colaborador. */
export type CreateCollaboratorProps = Readonly<{
  id: unknown;
  name: unknown;
  cpf: unknown;
  email: unknown;
}>;

/** Dados brutos aceitos para atualizar um colaborador. */
export type UpdateCollaboratorProps = Readonly<{
  name?: unknown;
  cpf?: unknown;
  email?: unknown;
}>;

/**
 * Aggregate root de colaborador.
 *
 * Cada transição retorna uma nova instância; o estado interno e as datas não
 * são expostos por referência mutável.
 */
export class Collaborator {
  private constructor(private readonly state: CollaboratorProps) {}

  /** Cópia congelada do estado interno, com novas instâncias de `Date`. */
  get props(): CollaboratorProps {
    return freezeProps(this.state);
  }

  /** Identificador único do colaborador. */
  get id(): string {
    return this.state.id;
  }

  /** Data da exclusão lógica (soft delete), ou `null` quando ainda ativo. */
  get deletedAt(): Date | null {
    return this.state.deletedAt ? new Date(this.state.deletedAt) : null;
  }

  /**
   * Cria um novo agregado ativo validando identificador, relógio e Value Objects.
   *
   * @param input - Dados brutos do colaborador (id, nome, cpf e e-mail).
   * @param now - Instante corrente usado para `createdAt` e `updatedAt`.
   * @returns Result com o `Collaborator` criado em caso de sucesso; em falha,
   * `CollaboratorDomainFailure` com código `VALIDATION_ERROR` quando o id é
   * vazio, `now` é inválido ou algum Value Object (nome, cpf, e-mail) não valida.
   */
  static create(
    input: CreateCollaboratorProps,
    now: Date
  ): Result<Collaborator, CollaboratorDomainFailure> {
    const id = normalizedId(input.id);
    if (!id)
      return err(collaboratorDomainFailure("VALIDATION_ERROR", "id must be a non-empty string"));
    if (!isValidDate(now)) {
      return err(collaboratorDomainFailure("VALIDATION_ERROR", "now must be a valid date"));
    }

    const name = CollaboratorName.create(input.name);
    if (name.isErr()) return err(name.error);
    const cpf = Cpf.create(input.cpf);
    if (cpf.isErr()) return err(cpf.error);
    const email = Email.create(input.email);
    if (email.isErr()) return err(email.error);

    return ok(
      new Collaborator(
        freezeProps({
          id,
          name: name.value,
          cpf: cpf.value,
          email: email.value,
          createdAt: now,
          updatedAt: now,
          deletedAt: null
        })
      )
    );
  }

  /**
   * Reconstitui dados persistidos, preservando as mesmas invariantes de criação.
   *
   * @param props - Estado já materializado (com Value Objects e datas) vindo da persistência.
   * @returns Result com o `Collaborator` reconstituído em caso de sucesso; em
   * falha, `CollaboratorDomainFailure` com código `VALIDATION_ERROR` quando os
   * Value Objects não são do tipo esperado ou as datas são inválidas.
   * @remarks
   * Ao contrário de `create`, aceita `deletedAt` preenchido para restaurar um
   * colaborador excluído logicamente, além de preservar o `updatedAt` original.
   */
  static reconstitute(props: CollaboratorProps): Result<Collaborator, CollaboratorDomainFailure> {
    if (
      !props ||
      !(props.name instanceof CollaboratorName) ||
      !(props.cpf instanceof Cpf) ||
      !(props.email instanceof Email) ||
      !isValidDate(props.createdAt) ||
      !isValidDate(props.updatedAt)
    ) {
      return err(collaboratorDomainFailure("VALIDATION_ERROR", "persistence dates must be valid"));
    }
    if (props.deletedAt !== null && !isValidDate(props.deletedAt)) {
      return err(collaboratorDomainFailure("VALIDATION_ERROR", "deletedAt must be a valid date"));
    }

    return Collaborator.create(
      {id: props.id, name: props.name.value, cpf: props.cpf.value, email: props.email.value},
      props.createdAt
    ).map(
      (collaborator) =>
        new Collaborator(
          freezeProps({
            ...collaborator.state,
            updatedAt: props.updatedAt,
            deletedAt: props.deletedAt
          })
        )
    );
  }

  /**
   * Aplica uma alteração parcial retornando uma nova instância do agregado.
   *
   * @param patch - Campos a atualizar (nome, cpf e/ou e-mail); ao menos um deve estar presente.
   * @param now - Instante corrente usado para atualizar `updatedAt`.
   * @returns Result com o novo `Collaborator` em caso de sucesso; em falha,
   * `CollaboratorDomainFailure` com código `COLLABORATOR_DELETED` quando o
   * colaborador já foi excluído, ou `VALIDATION_ERROR` quando `now` é inválido,
   * o patch não é um objeto válido, está vazio, contém campos desconhecidos ou
   * algum Value Object informado não valida.
   * @remarks
   * O agregado é imutável: a instância original permanece inalterada.
   */
  update(
    patch: UpdateCollaboratorProps,
    now: Date
  ): Result<Collaborator, CollaboratorDomainFailure> {
    if (this.state.deletedAt !== null) return err(collaboratorAlreadyDeletedFailure());
    if (!isValidDate(now)) {
      return err(collaboratorDomainFailure("VALIDATION_ERROR", "now must be a valid date"));
    }
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
      return err(collaboratorDomainFailure("VALIDATION_ERROR", "patch must be an object"));
    }

    const keys = Object.keys(patch);
    if (keys.length === 0 || keys.some((key) => !["name", "cpf", "email"].includes(key))) {
      return err(collaboratorDomainFailure("VALIDATION_ERROR", "patch must contain known fields"));
    }

    const name =
      patch.name === undefined ? ok(this.state.name) : CollaboratorName.create(patch.name);
    if (name.isErr()) return err(name.error);
    const cpf = patch.cpf === undefined ? ok(this.state.cpf) : Cpf.create(patch.cpf);
    if (cpf.isErr()) return err(cpf.error);
    const email = patch.email === undefined ? ok(this.state.email) : Email.create(patch.email);
    if (email.isErr()) return err(email.error);

    return ok(
      new Collaborator(
        freezeProps({
          ...this.state,
          name: name.value,
          cpf: cpf.value,
          email: email.value,
          updatedAt: now
        })
      )
    );
  }

  /**
   * Marca o colaborador como excluído logicamente (soft delete).
   *
   * @param now - Instante corrente usado para `deletedAt` e `updatedAt`.
   * @returns Result com um novo `Collaborator` já excluído em caso de sucesso;
   * em falha, `CollaboratorDomainFailure` com código `VALIDATION_ERROR` quando
   * `now` é inválido.
   * @remarks
   * Operação idempotente: se o colaborador já estiver excluído, retorna a
   * própria instância sem alterar as datas.
   */
  softDelete(now: Date): Result<Collaborator, CollaboratorDomainFailure> {
    if (!isValidDate(now)) {
      return err(collaboratorDomainFailure("VALIDATION_ERROR", "now must be a valid date"));
    }
    if (this.state.deletedAt !== null) return ok(this);

    return ok(
      new Collaborator(
        freezeProps({
          ...this.state,
          updatedAt: now,
          deletedAt: now
        })
      )
    );
  }
}

function normalizedId(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const id = value.trim();
  return id.length > 0 ? id : undefined;
}

function isValidDate(value: unknown): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

function freezeProps(value: CollaboratorProps): CollaboratorProps {
  return Object.freeze({
    ...value,
    createdAt: new Date(value.createdAt),
    updatedAt: new Date(value.updatedAt),
    deletedAt: value.deletedAt ? new Date(value.deletedAt) : null
  });
}
