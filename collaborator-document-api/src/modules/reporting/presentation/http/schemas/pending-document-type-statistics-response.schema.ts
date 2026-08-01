import {
  AdditionalProperties,
  CollectionOf,
  Integer,
  Minimum,
  Name,
  Property,
  Required
} from "@tsed/schema";

import {HalLink} from "../../../../../shared/presentation/http/schemas/hal-link.js";
import {
  DocumentTypeSummaryResponse,
  PendingDocumentPageLinks
} from "./pending-document-response.schema.js";

@AdditionalProperties({$ref: "#/components/schemas/HalLink"})
@Name("HalLinks")
export class PendingDocumentTypeStatisticLinks {
  [relation: string]: HalLink;
}

@AdditionalProperties(false)
@Name("PendingDocumentTypeStatistic")
export class PendingDocumentTypeStatisticResponse {
  @Required()
  @Property(DocumentTypeSummaryResponse)
  documentType!: DocumentTypeSummaryResponse;

  @Required()
  @Integer()
  @Minimum(1)
  @Property(Number)
  pendingCount!: number;

  @Required()
  @Property(PendingDocumentTypeStatisticLinks)
  _links!: PendingDocumentTypeStatisticLinks;
}

@AdditionalProperties(false)
export class PendingDocumentTypeStatisticsEmbedded {
  @Required()
  @CollectionOf(PendingDocumentTypeStatisticResponse)
  "document-types"!: PendingDocumentTypeStatisticResponse[];
}

@AdditionalProperties(false)
@Name("PendingDocumentTypeStatisticsCollection")
export class PendingDocumentTypeStatisticsCollectionResponse {
  @Required()
  @Integer()
  @Minimum(0)
  @Property(Number)
  count!: number;

  @Required()
  @Property(PendingDocumentTypeStatisticsEmbedded)
  _embedded!: PendingDocumentTypeStatisticsEmbedded;

  @Required()
  @Property(PendingDocumentPageLinks)
  _links!: PendingDocumentPageLinks;
}
