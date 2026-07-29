/**
 * Falha genérica da camada de aplicação.
 *
 * Usada para representar erros operacionais
 * (indisponibilidade de dependências, erros de
 * autorização, etc.) com um código categorizável.
 */
export class ApplicationFailure extends Error {
  readonly kind = "application";

  constructor(
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "ApplicationFailure";
  }
}
