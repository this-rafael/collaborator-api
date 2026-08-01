import type {Document} from "mongodb";

import type {PendingDocumentTypeStatisticPosition} from "../../../../application/models/pending-document-type-statistic.view.js";
import type {PendingDocumentTypeStatisticFilters} from "../../../../application/ports/pending-document-type-statistics.read-model.js";

/** Monta o pipeline agregado do ranking de tipos com pendências. */
export const pendingDocumentTypeStatisticsPipeline = (input: {
  filters: PendingDocumentTypeStatisticFilters;
  limit: number;
  after?: PendingDocumentTypeStatisticPosition;
}): Document[] => [
  {$match: input.filters},
  {$group: {_id: "$documentTypeId", pendingCount: {$sum: 1}}},
  ...(input.after ? [{$match: keysetAfter(input.after)}] : []),
  {
    $lookup: {
      from: "document_types",
      let: {foreignId: "$_id"},
      pipeline: [
        {$match: {$expr: {$eq: [{$toString: "$_id"}, "$$foreignId"]}, deletedAt: null}},
        {$project: {name: 1, code: 1}}
      ],
      as: "documentType"
    }
  },
  {$unwind: "$documentType"},
  {$sort: {pendingCount: -1, _id: 1}},
  {$limit: input.limit + 1},
  {
    $project: {
      _id: 0,
      pendingCount: 1,
      documentType: {
        id: {$toString: "$documentType._id"},
        name: "$documentType.name",
        code: "$documentType.code"
      }
    }
  }
];

function keysetAfter(position: PendingDocumentTypeStatisticPosition): Document {
  return {
    $or: [
      {pendingCount: {$lt: position.pendingCount}},
      {pendingCount: position.pendingCount, _id: {$gt: position.documentTypeId}}
    ]
  };
}
