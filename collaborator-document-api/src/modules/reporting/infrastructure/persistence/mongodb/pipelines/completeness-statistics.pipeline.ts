import type {Document} from "mongodb";

import type {ActiveDocumentFilters} from "../../../../application/ports/completeness-statistics.read-model.js";

/** Monta o pipeline de contagem dos vínculos documentais ativos. */
export const completenessStatisticsPipeline = (filters: ActiveDocumentFilters): Document[] => [
  {$match: filters},
  {
    $group: {
      _id: null,
      totalActiveDocuments: {$sum: 1},
      submittedDocuments: {
        $sum: {$cond: [{$eq: ["$status", "SUBMITTED"]}, 1, 0]}
      }
    }
  },
  {$project: {_id: 0, totalActiveDocuments: 1, submittedDocuments: 1}}
];
