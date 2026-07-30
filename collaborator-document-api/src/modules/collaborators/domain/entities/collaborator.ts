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

export type CreateCollaboratorProps = Readonly<{
  id: unknown;
  name: unknown;
  cpf: unknown;
  email: unknown;
}>;

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

  get props(): CollaboratorProps {
    return freezeProps(this.state);
  }

  get id(): string {
    return this.state.id;
  }

  get deletedAt(): Date | null {
    return this.state.deletedAt ? new Date(this.state.deletedAt) : null;
  }

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

  /** Reconstitui dados persistidos, preservando as mesmas invariantes de criação. */
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
