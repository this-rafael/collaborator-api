import {
  AdditionalProperties,
  Format,
  Integer,
  Maximum,
  Minimum,
  MultipleOf,
  Name,
  Property,
  Required
} from "@tsed/schema";

import {HalLink} from "../../../../../shared/presentation/http/schemas/hal-link.js";

@AdditionalProperties(false)
export class CompletenessStatisticsLinks {
  @Required()
  @Property(HalLink)
  self!: HalLink;

  @Required()
  @Property(HalLink)
  "pending-documents"!: HalLink;

  @Required()
  @Property(HalLink)
  "pending-document-types"!: HalLink;
}

@AdditionalProperties(false)
@Name("CompletenessStatistics")
export class CompletenessStatisticsResponse {
  @Required()
  @Integer()
  @Minimum(0)
  @Property(Number)
  totalActiveDocuments!: number;

  @Required()
  @Integer()
  @Minimum(0)
  @Property(Number)
  submittedDocuments!: number;

  @Required()
  @Integer()
  @Minimum(0)
  @Property(Number)
  pendingDocuments!: number;

  @Required()
  @Minimum(0)
  @Maximum(100)
  @MultipleOf(0.01)
  @Property(Number)
  percentage!: number;

  @Required()
  @Format("date-time")
  @Property(String)
  calculatedAt!: string;

  @Required()
  @Property(CompletenessStatisticsLinks)
  _links!: CompletenessStatisticsLinks;
}
