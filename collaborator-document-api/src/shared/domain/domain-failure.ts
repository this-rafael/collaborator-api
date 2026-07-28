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
