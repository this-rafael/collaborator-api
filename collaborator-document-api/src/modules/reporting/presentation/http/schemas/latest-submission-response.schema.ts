import {
  AdditionalProperties,
  CollectionOf,
  Format,
  Integer,
  Minimum,
  Name,
  Pattern,
  Property,
  Required
} from "@tsed/schema";

import {HalLink} from "../../../../../shared/presentation/http/schemas/hal-link.js";
import {
  CollaboratorSummaryResponse,
  DocumentTypeSummaryResponse,
  PendingDocumentPageLinks
} from "./pending-document-response.schema.js";

@AdditionalProperties({$ref: "#/components/schemas/HalLink"})
@Name("HalLinks")
export class LatestSubmissionLinks {
  [relation: string]: HalLink;
}

@AdditionalProperties(false)
@Name("LatestSubmission")
export class LatestSubmissionResponse {
  @Required()
  @Pattern(/^[a-fA-F\d]{24}$/)
  @Property(String)
  documentId!: string;

  @Required()
  @Integer()
  @Minimum(1)
  @Property(Number)
  currentVersion!: number;

  @Required()
  @Format("date-time")
  @Property(String)
  lastSubmittedAt!: string;

  @Required()
  @Property(CollaboratorSummaryResponse)
  collaborator!: CollaboratorSummaryResponse;

  @Required()
  @Property(DocumentTypeSummaryResponse)
  documentType!: DocumentTypeSummaryResponse;

  @Required()
  @Property(LatestSubmissionLinks)
  _links!: LatestSubmissionLinks;
}

@AdditionalProperties(false)
export class LatestSubmissionCollectionEmbedded {
  @Required()
  @CollectionOf(LatestSubmissionResponse)
  submissions!: LatestSubmissionResponse[];
}

@AdditionalProperties(false)
@Name("LatestSubmissionCollection")
export class LatestSubmissionCollectionResponse {
  @Required()
  @Integer()
  @Minimum(0)
  @Property(Number)
  count!: number;

  @Required()
  @Property(LatestSubmissionCollectionEmbedded)
  _embedded!: LatestSubmissionCollectionEmbedded;

  @Required()
  @Property(PendingDocumentPageLinks)
  _links!: PendingDocumentPageLinks;
}
