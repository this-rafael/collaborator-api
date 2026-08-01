import {err, ok, type Result} from "neverthrow";

import type {Clock} from "../../../../shared/application/ports/clock.js";
import type {CompletenessStatisticsView} from "../models/completeness-statistics.view.js";
import type {CompletenessStatisticsReadModel} from "../ports/completeness-statistics.read-model.js";
import type {ReportingFailure} from "../reporting.failure.js";

const activeDocumentFilters = Object.freeze({deletedAt: null, unlinkedAt: null});

/** Calcula a completude global a partir do read model agregado. */
export class GetCompletenessStatisticsQuery {
  constructor(
    private readonly readModel: Pick<CompletenessStatisticsReadModel, "getCounts">,
    private readonly clock: Clock
  ) {}

  async execute(): Promise<Result<CompletenessStatisticsView, ReportingFailure>> {
    const counts = await this.readModel.getCounts(activeDocumentFilters);
    if (counts.isErr()) return err(counts.error);

    const {totalActiveDocuments, submittedDocuments} = counts.value;
    return ok({
      totalActiveDocuments,
      submittedDocuments,
      pendingDocuments: totalActiveDocuments - submittedDocuments,
      percentage: percentageOf(submittedDocuments, totalActiveDocuments),
      calculatedAt: this.clock.now().toISOString()
    });
  }
}

function percentageOf(submittedDocuments: number, totalActiveDocuments: number): number {
  if (totalActiveDocuments === 0) return 0;

  const numerator = BigInt(submittedDocuments) * 10_000n;
  const denominator = BigInt(totalActiveDocuments);
  const roundedHundredths = (numerator * 2n + denominator) / (denominator * 2n);
  return Number(roundedHundredths) / 100;
}
