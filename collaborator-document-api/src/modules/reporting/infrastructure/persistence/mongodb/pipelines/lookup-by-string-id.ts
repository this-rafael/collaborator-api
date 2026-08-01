import type {Document} from "mongodb";

/** Lookup Mongo por igualdade de `_id` stringificado com projeção. */
export function lookupByStringId(
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
