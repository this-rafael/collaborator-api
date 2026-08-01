import {ObjectId, type Document} from "mongodb";

import type {SubmissionEventPosition} from "../../../../application/models/submission-event.view.js";
import type {SubmissionEventFilters} from "../../../../application/ports/submission-events.read-model.js";

/** Monta o pipeline projetado da página de eventos de envio. */
export const submissionEventsPipeline = (input: {
  filters: SubmissionEventFilters;
  limit: number;
  after?: SubmissionEventPosition;
}): Document[] => {
  const pageMatch = input.after ? [{$match: {$or: keysetAfter(input.after)}}] : [];

  return [
    {
      $match: {
        deletedAt: input.filters.deletedAt,
        unlinkedAt: input.filters.unlinkedAt,
        "versions.0": {$exists: input.filters.hasVersions}
      }
    },
    {$unwind: "$versions"},
    ...pageMatch,
    {$sort: {"versions.submittedAt": -1, _id: -1, "versions.version": -1}},
    {$limit: input.limit + 1},
    {
      $project: {
        _id: 0,
        documentId: {$toString: "$_id"},
        version: "$versions.version",
        submittedAt: "$versions.submittedAt",
        metadata: "$versions.metadata"
      }
    }
  ];
};

function keysetAfter(position: SubmissionEventPosition): Document[] {
  const submittedAt = new Date(position.submittedAt);
  const documentId = new ObjectId(position.documentId);
  return [
    {"versions.submittedAt": {$lt: submittedAt}},
    {"versions.submittedAt": submittedAt, _id: {$lt: documentId}},
    {
      "versions.submittedAt": submittedAt,
      _id: documentId,
      "versions.version": {$lt: position.version}
    }
  ];
}
