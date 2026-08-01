import {ObjectId, type Document} from "mongodb";

import type {PendingDocumentPosition} from "../../../../application/models/pending-document.view.js";
import type {PendingDocumentFilters} from "../../../../application/ports/pending-documents.read-model.js";

/** Monta o pipeline projetado da página de pendências. */
export const pendingDocumentsPipeline = (input: {
  filters: PendingDocumentFilters;
  limit: number;
  after?: PendingDocumentPosition;
}): Document[] => {
  const baseMatch: Document = {
    status: "PENDING",
    deletedAt: null,
    unlinkedAt: null
  };
  if (input.after) baseMatch.$or = keysetAfter(input.after);

  const hydratedMatch: Document = {};
  if (input.filters.collaboratorName) {
    hydratedMatch["collaborator.nameNormalized"] = {
      $regex: escapeRegex(input.filters.collaboratorName)
    };
  }
  if (input.filters.cpf) hydratedMatch["collaborator.cpf"] = input.filters.cpf;
  if (input.filters.documentTypeName) {
    hydratedMatch["documentType.nameNormalized"] = {
      $regex: escapeRegex(input.filters.documentTypeName)
    };
  }
  if (input.filters.documentTypeCode) {
    hydratedMatch["documentType.code"] = input.filters.documentTypeCode;
  }

  return [
    {$match: baseMatch},
    lookupByStringId("collaborators", "collaboratorId", "collaborator", {
      name: 1,
      nameNormalized: 1,
      cpf: 1
    }),
    {$unwind: "$collaborator"},
    lookupByStringId("document_types", "documentTypeId", "documentType", {
      name: 1,
      nameNormalized: 1,
      code: 1
    }),
    {$unwind: "$documentType"},
    ...(Object.keys(hydratedMatch).length > 0 ? [{$match: hydratedMatch}] : []),
    {$sort: {documentTypeId: 1, collaboratorId: 1, _id: 1}},
    {$limit: input.limit + 1},
    {
      $project: {
        _id: 0,
        id: {$toString: "$_id"},
        status: 1,
        linkedAt: 1,
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

function lookupByStringId(
  from: string,
  localField: string,
  as: string,
  projection: Document
): Document {
  return {
    $lookup: {
      from,
      let: {foreignId: `$${localField}`},
      pipeline: [
        {$match: {$expr: {$eq: [{$toString: "$_id"}, "$$foreignId"]}}},
        {$project: projection}
      ],
      as
    }
  };
}

function keysetAfter(position: PendingDocumentPosition): Document[] {
  return [
    {documentTypeId: {$gt: position.documentTypeId}},
    {
      documentTypeId: position.documentTypeId,
      collaboratorId: {$gt: position.collaboratorId}
    },
    {
      documentTypeId: position.documentTypeId,
      collaboratorId: position.collaboratorId,
      _id: {$gt: new ObjectId(position.id)}
    }
  ];
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
