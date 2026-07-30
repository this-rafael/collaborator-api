/**
 * Falhas modeladas pelo módulo de colaboradores.
 *
 * Falhas são dados discriminados, nunca instâncias de `Error`: desta forma o
 * fluxo Result consegue atravessar domínio, aplicação e apresentação sem
 * depender de exceções para regras esperadas de negócio.
 */
export type CollaboratorDomainFailureCode = "VALIDATION_ERROR" | "COLLABORATOR_DELETED";

export type CollaboratorApplicationFailureCode =
  | "COLLABORATOR_NOT_FOUND"
  | "DUPLICATE_ACTIVE_CPF"
  | "DUPLICATE_ACTIVE_EMAIL"
  | "INVALID_QUERY_PARAMETER"
  | "SERVICE_UNAVAILABLE"
  | "INTERNAL_SERVER_ERROR";

export type CollaboratorDomainFailure = Readonly<{
  kind: "domain";
  code: CollaboratorDomainFailureCode;
  message: string;
}>;

export type CollaboratorApplicationFailure = Readonly<{
  kind: "application";
  code: CollaboratorApplicationFailureCode;
  message: string;
}>;

export type CollaboratorFailure = CollaboratorDomainFailure | CollaboratorApplicationFailure;

export const collaboratorDomainFailure = (
  code: CollaboratorDomainFailureCode,
  message: string
): CollaboratorDomainFailure => ({kind: "domain", code, message});

export const collaboratorApplicationFailure = (
  code: CollaboratorApplicationFailureCode,
  message: string
): CollaboratorApplicationFailure => ({kind: "application", code, message});
