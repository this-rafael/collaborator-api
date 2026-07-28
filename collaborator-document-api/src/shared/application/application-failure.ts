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
