import {
  AdditionalProperties,
  Enum,
  Format,
  Integer,
  Maximum,
  Minimum,
  Property,
  Required
} from "@tsed/schema";

/** Erro de validação associado a um campo específico da entrada. */
@AdditionalProperties(false)
export class FieldError {
  @Required()
  @Property(String)
  field!: string;

  @Required()
  @Property(String)
  code!: string;

  @Required()
  @Property(String)
  message!: string;
}

/**
 * Schema de erro padronizado no formato Problem Details
 * (RFC 9457).
 *
 * Inclui campos padrão (`type`, `title`, `status`,
 * `detail`, `instance`) e campos estendidos (`code`,
 * `traceId`).
 */
@AdditionalProperties(false)
export class ProblemDetails {
  [key: string]: unknown;

  @Required()
  @Format("uri")
  @Property(String)
  type!: string;

  @Required()
  @Property(String)
  title!: string;

  @Required()
  @Integer()
  @Minimum(400)
  @Maximum(599)
  @Property(Number)
  status!: number;

  @Required()
  @Property(String)
  detail!: string;

  @Required()
  @Property(String)
  instance!: string;

  @Required()
  @Enum(
    "MALFORMED_JSON",
    "INVALID_QUERY_PARAMETER",
    "INVALID_OBJECT_ID",
    "INVALID_VERSION_NUMBER",
    "COLLABORATOR_NOT_FOUND",
    "COLLABORATOR_DELETED",
    "DUPLICATE_ACTIVE_CPF",
    "DUPLICATE_ACTIVE_EMAIL",
    "DOCUMENT_TYPE_NOT_FOUND",
    "DOCUMENT_TYPE_DELETED",
    "DUPLICATE_ACTIVE_DOCUMENT_TYPE_CODE",
    "COLLABORATOR_DOCUMENT_NOT_FOUND",
    "ACTIVE_LINK_ALREADY_EXISTS",
    "COLLABORATOR_DOCUMENT_UNLINKED",
    "COLLABORATOR_DOCUMENT_DELETED",
    "INVALID_DOCUMENT_STATE",
    "DOCUMENT_VERSION_NOT_FOUND",
    "DOCUMENT_HISTORY_LIMIT_REACHED",
    "VALIDATION_ERROR",
    "RATE_LIMIT_EXCEEDED",
    "UNSUPPORTED_MEDIA_TYPE",
    "INTERNAL_SERVER_ERROR",
    "SERVICE_UNAVAILABLE"
  )
  @Property(String)
  code!: string;

  @Required()
  @Property(String)
  traceId!: string;

  @Property(FieldError)
  errors?: FieldError[];
}
