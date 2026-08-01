import {ObjectId, type Document} from "mongodb";

import type {LatestSubmissionPosition} from "../../../../application/models/latest-submission.view.js";
import type {LatestSubmissionFilters} from "../../../../application/ports/latest-submissions.read-model.js";
import {lookupByStringId} from "./lookup-by-string-id.js";

/** Monta o pipeline projetado da página de últimos envios. */
export const latestSubmissionsPipeline = (input: {
  filters: LatestSubmissionFilters;
  limit: number;
  after?: LatestSubmissionPosition;
}): Document[] => {
  const baseMatch: Document = {
    status: input.filters.status,
    deletedAt: input.filters.deletedAt,
    unlinkedAt: input.filters.unlinkedAt,
    lastSubmittedAt: {$ne: null}
  };
  if (input.after) baseMatch.$or = keysetAfter(input.after);

  return [
    {$match: baseMatch},
    {$sort: {lastSubmittedAt: -1, _id: -1}},
    {$limit: input.limit + 1},
    lookupByStringId("collaborators", "collaboratorId", "collaborator", {
      name: 1,
      cpf: 1
    }),
    {$unwind: "$collaborator"},
    lookupByStringId("document_types", "documentTypeId", "documentType", {
      name: 1,
      code: 1
    }),
    {$unwind: "$documentType"},
    {
      $project: {
        _id: 0,
        documentId: {$toString: "$_id"},
        currentVersion: 1,
        lastSubmittedAt: 1,
        collaborator: {
          id: {$toString: "$collaborator._id"},
          name: "$collaborator.name",
          cpf: "$collaborator.cpf"
        },
        documentType: {
          id: {$toString: "$documentType._id"},
          name: "$documentType.name",
          code: "$documentType.code"
        }
      }
    }
  ];
};

function keysetAfter(position: LatestSubmissionPosition): Document[] {
  const submittedAt = new Date(position.lastSubmittedAt);
  return [
    {lastSubmittedAt: {$lt: submittedAt}},
    {lastSubmittedAt: submittedAt, _id: {$lt: new ObjectId(position.id)}}
  ];
}
