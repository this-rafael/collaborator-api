/**
 * Agregado de tipo de documento e suas invariantes de domínio.
 * Fornece criação, reconstituição, atualização e soft delete de forma imutável,
 * reportando falhas via Result — sem throw de negócio.
 */
import {err, ok, type Result} from "neverthrow";

import {documentTypeAlreadyDeletedFailure} from "../errors/document-type-already-deleted.failure.js";
import {
  documentTypeDomainFailure,
  type DocumentTypeDomainFailure
} from "../errors/document-type.failure.js";
import {DocumentTypeCode} from "../value-objects/document-type-code.js";
import {DocumentTypeName} from "../value-objects/document-type-name.js";

/** Estado imutável do agregado de tipo de documento. */
export type DocumentTypeProps = Readonly<{
  /** Identificador único do tipo de documento. */
  id: string;
  /** Nome validado do tipo de documento. */
  name: DocumentTypeName;
  /** Código estável e único entre os tipos ativos. */
  code: DocumentTypeCode;
  /** Descrição opcional; `null` quando não informada. */
  description: string | null;
  /** Instante de criação do registro. */
  createdAt: Date;
  /** Instante da última atualização. */
  updatedAt: Date;
  /** Instante do soft delete; `null` enquanto o tipo estiver ativo. */
  deletedAt: Date | null;
}>;

/** Dados brutos aceitos para criar um tipo de documento. */
export type CreateDocumentTypeProps = Readonly<{
  /** Identificador candidato; validado como string não vazia. */
  id: unknown;
  /** Nome candidato; validado por `DocumentTypeName`. */
  name: unknown;
  /** Código candidato; validado por `DocumentTypeCode`. */
  code: unknown;
  /** Descrição candidata opcional; string de até 1000 caracteres ou `null`. */
  description?: unknown;
}>;

/** Dados brutos aceitos para atualizar um tipo de documento. */
export type UpdateDocumentTypeProps = Readonly<{
  /** Novo nome candidato; ignorado quando `undefined`. */
  name?: unknown;
  /** Novo código candidato; ignorado quando `undefined`. */
  code?: unknown;
  /** Nova descrição candidata; presença explícita permite defini-la como `null`. */
  description?: unknown;
}>;

/**
 * Aggregate root de tipo de documento.
 *
 * @remarks
 * Instâncias são imutáveis: operações de mutação retornam uma nova instância.
 * A criação e a reconstituição ocorrem exclusivamente pelos métodos estáticos
 * `create` e `reconstitute`, que validam as invariantes do domínio via `Result`.
 */
export class DocumentType {
  /**
   * Uso interno; instâncias são criadas por `create` ou `reconstitute`.
   *
   * @param state - Estado imutável já validado do agregado.
   */
  private constructor(private readonly state: DocumentTypeProps) {}

  /** Cópia congelada e defensiva do estado atual do agregado. */
  get props(): DocumentTypeProps {
    return freezeProps(this.state);
  }

  /** Identificador único do tipo de documento. */
  get id(): string {
    return this.state.id;
  }

  /** Cópia do instante de soft delete, ou `null` quando o tipo está ativo. */
  get deletedAt(): Date | null {
    return this.state.deletedAt ? new Date(this.state.deletedAt) : null;
  }

  /**
   * Cria um novo tipo de documento validando todas as invariantes do domínio.
   *
   * @param input - Dados brutos de criação (id, nome, código e descrição).
   * @param now - Instante corrente usado como `createdAt` e `updatedAt`.
   * @returns Result com o `DocumentType` em sucesso; em falha,
   * `DocumentTypeDomainFailure` com código `VALIDATION_ERROR` (id inválido,
   * data inválida, ou nome/código/descrição fora das regras).
   */
  static create(
    input: CreateDocumentTypeProps,
    now: Date
  ): Result<DocumentType, DocumentTypeDomainFailure> {
    const id = normalizedId(input.id);
    if (!id)
      return err(documentTypeDomainFailure("VALIDATION_ERROR", "id must be a non-empty string"));
    if (!isValidDate(now)) {
      return err(documentTypeDomainFailure("VALIDATION_ERROR", "now must be a valid date"));
    }

    const name = DocumentTypeName.create(input.name);
    if (name.isErr()) return err(name.error);
    const code = DocumentTypeCode.create(input.code);
    if (code.isErr()) return err(code.error);
    const description = parseDescription(
      Object.hasOwn(input, "description") ? input.description : undefined,
      true
    );
    if (description.isErr()) return err(description.error);

    return ok(
      new DocumentType(
        freezeProps({
          id,
          name: name.value,
          code: code.value,
          description: description.value,
          createdAt: now,
          updatedAt: now,
          deletedAt: null
        })
      )
    );
  }

  /**
   * Reconstitui um agregado a partir de um estado já persistido, revalidando as
   * invariantes e preservando `updatedAt` e `deletedAt` originais.
   *
   * @param props - Estado completo recuperado da persistência.
   * @returns Result com o `DocumentType` reconstituído em sucesso; em falha,
   * `DocumentTypeDomainFailure` com código `VALIDATION_ERROR` quando datas,
   * descrição ou objetos de valor forem inválidos.
   */
  static reconstitute(props: DocumentTypeProps): Result<DocumentType, DocumentTypeDomainFailure> {
    if (
      !props ||
      !(props.name instanceof DocumentTypeName) ||
      !(props.code instanceof DocumentTypeCode) ||
      !isValidDate(props.createdAt) ||
      !isValidDate(props.updatedAt)
    ) {
      return err(documentTypeDomainFailure("VALIDATION_ERROR", "persistence dates must be valid"));
    }
    if (props.deletedAt !== null && !isValidDate(props.deletedAt)) {
      return err(documentTypeDomainFailure("VALIDATION_ERROR", "deletedAt must be a valid date"));
    }
    if (props.description !== null && typeof props.description !== "string") {
      return err(documentTypeDomainFailure("VALIDATION_ERROR", "description must be string|null"));
    }
    if (typeof props.description === "string" && props.description.length > 1000) {
      return err(
        documentTypeDomainFailure(
          "VALIDATION_ERROR",
          "description must contain at most 1000 characters"
        )
      );
    }

    return DocumentType.create(
      {
        id: props.id,
        name: props.name.value,
        code: props.code.value,
        description: props.description
      },
      props.createdAt
    ).map(
      (documentType) =>
        new DocumentType(
          freezeProps({
            ...documentType.state,
            updatedAt: props.updatedAt,
            deletedAt: props.deletedAt
          })
        )
    );
  }

  /**
   * Aplica uma atualização parcial ao tipo de documento, produzindo uma nova
   * instância com `updatedAt` renovado.
   *
   * @param patch - Campos a atualizar (nome, código e/ou descrição); ao menos
   * um campo conhecido deve ser informado.
   * @param now - Instante corrente usado como novo `updatedAt`.
   * @returns Result com o `DocumentType` atualizado em sucesso; em falha,
   * `DocumentTypeDomainFailure` com código `DOCUMENT_TYPE_DELETED` quando o tipo
   * já foi excluído, ou `VALIDATION_ERROR` para data/patch/campos inválidos.
   */
  update(
    patch: UpdateDocumentTypeProps,
    now: Date
  ): Result<DocumentType, DocumentTypeDomainFailure> {
    if (this.state.deletedAt !== null) return err(documentTypeAlreadyDeletedFailure());
    if (!isValidDate(now)) {
      return err(documentTypeDomainFailure("VALIDATION_ERROR", "now must be a valid date"));
    }
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
      return err(documentTypeDomainFailure("VALIDATION_ERROR", "patch must be an object"));
    }

    const keys = Object.keys(patch);
    if (keys.length === 0 || keys.some((key) => !["name", "code", "description"].includes(key))) {
      return err(documentTypeDomainFailure("VALIDATION_ERROR", "patch must contain known fields"));
    }

    const name =
      patch.name === undefined ? ok(this.state.name) : DocumentTypeName.create(patch.name);
    if (name.isErr()) return err(name.error);
    const code =
      patch.code === undefined ? ok(this.state.code) : DocumentTypeCode.create(patch.code);
    if (code.isErr()) return err(code.error);

    let description: Result<string | null, DocumentTypeDomainFailure> = ok(this.state.description);
    if (Object.hasOwn(patch, "description")) {
      description = parseDescription(patch.description, false);
    }
    if (description.isErr()) return err(description.error);

    return ok(
      new DocumentType(
        freezeProps({
          ...this.state,
          name: name.value,
          code: code.value,
          description: description.value,
          updatedAt: now
        })
      )
    );
  }

  /**
   * Marca o tipo de documento como excluído (soft delete), preenchendo
   * `deletedAt` e `updatedAt`.
   *
   * @param now - Instante corrente usado como `deletedAt` e `updatedAt`.
   * @returns Result com o `DocumentType` excluído em sucesso; se o tipo já
   * estiver excluído, retorna a própria instância inalterada. Em falha,
   * `DocumentTypeDomainFailure` com código `VALIDATION_ERROR` para data inválida.
   */
  softDelete(now: Date): Result<DocumentType, DocumentTypeDomainFailure> {
    if (!isValidDate(now)) {
      return err(documentTypeDomainFailure("VALIDATION_ERROR", "now must be a valid date"));
    }
    if (this.state.deletedAt !== null) return ok(this);

    return ok(
      new DocumentType(
        freezeProps({
          ...this.state,
          updatedAt: now,
          deletedAt: now
        })
      )
    );
  }
}

function parseDescription(
  input: unknown,
  omitMeansNull: boolean
): Result<string | null, DocumentTypeDomainFailure> {
  if (input === undefined) {
    return omitMeansNull
      ? ok(null)
      : err(documentTypeDomainFailure("VALIDATION_ERROR", "description is invalid"));
  }
  if (input === null) return ok(null);
  if (typeof input !== "string") {
    return err(
      documentTypeDomainFailure("VALIDATION_ERROR", "description must be a string or null")
    );
  }
  if (input.length > 1000) {
    return err(
      documentTypeDomainFailure(
        "VALIDATION_ERROR",
        "description must contain at most 1000 characters"
      )
    );
  }
  return ok(input);
}

function normalizedId(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const id = value.trim();
  return id.length > 0 ? id : undefined;
}

function isValidDate(value: unknown): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

function freezeProps(value: DocumentTypeProps): DocumentTypeProps {
  return Object.freeze({
    ...value,
    createdAt: new Date(value.createdAt),
    updatedAt: new Date(value.updatedAt),
    deletedAt: value.deletedAt ? new Date(value.deletedAt) : null
  });
}
