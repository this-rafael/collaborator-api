/**
 * Falha genérica da camada de domínio.
 *
 * Usada como base para erros de validação e violação de
 * regras de negócio no domínio.
 */
export class DomainFailure extends Error {
  readonly kind = "domain";

  constructor(
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "DomainFailure";
  }
}
