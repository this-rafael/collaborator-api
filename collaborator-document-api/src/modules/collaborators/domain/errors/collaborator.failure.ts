/**
 * Falhas modeladas pelo módulo de colaboradores.
 *
 * Falhas são dados discriminados, nunca instâncias de `Error`: desta forma o
 * fluxo Result consegue atravessar domínio, aplicação e apresentação sem
 * depender de exceções para regras esperadas de negócio.
 */
/** Código de falha de domínio para colaboradores. */
export type CollaboratorDomainFailureCode = "VALIDATION_ERROR" | "COLLABORATOR_DELETED";

/** Código de falha de aplicação para colaboradores. */
export type CollaboratorApplicationFailureCode =
  | "COLLABORATOR_NOT_FOUND"
  | "DUPLICATE_ACTIVE_CPF"
  | "DUPLICATE_ACTIVE_EMAIL"
  | "INVALID_QUERY_PARAMETER"
  | "SERVICE_UNAVAILABLE"
  | "INTERNAL_SERVER_ERROR";

/** Falha de domínio no módulo de colaboradores. */
export type CollaboratorDomainFailure = Readonly<{
  kind: "domain";
  code: CollaboratorDomainFailureCode;
  message: string;
}>;

/** Falha de aplicação no módulo de colaboradores. */
export type CollaboratorApplicationFailure = Readonly<{
  kind: "application";
  code: CollaboratorApplicationFailureCode;
  message: string;
}>;

/** União de todas as falhas possíveis do módulo de colaboradores. */
export type CollaboratorFailure = CollaboratorDomainFailure | CollaboratorApplicationFailure;

/** Construtor de falha de domínio para colaboradores. */
export const collaboratorDomainFailure = (
  code: CollaboratorDomainFailureCode,
  message: string
): CollaboratorDomainFailure => ({kind: "domain", code, message});

/** Construtor de falha de aplicação para colaboradores. */
export const collaboratorApplicationFailure = (
  code: CollaboratorApplicationFailureCode,
  message: string
): CollaboratorApplicationFailure => ({kind: "application", code, message});
