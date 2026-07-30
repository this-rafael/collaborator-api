export type TransactionFailure = "TransientTransactionError" | "UnknownTransactionCommitResult";

export class MongoTransactionTestHarness {
  private readonly failures: TransactionFailure[] = [];

  failNext(error: TransactionFailure): void {
    this.failures.push(error);
  }

  nextFailure(): TransactionFailure | undefined {
    return this.failures.shift();
  }
}
