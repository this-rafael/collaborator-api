import {
  AdditionalProperties,
  CollectionOf,
  Format,
  Integer,
  MaxLength,
  Minimum,
  MinLength,
  Name,
  Nullable,
  Pattern,
  Property,
  Required
} from "@tsed/schema";

import {HalLink} from "../../../../../shared/presentation/http/schemas/hal-link.js";
import {PendingDocumentPageLinks} from "./pending-document-response.schema.js";

@AdditionalProperties(false)
@Name("DocumentMetadata")
export class SubmissionEventMetadataResponse {
  @Required()
  @Property(String)
  @MinLength(1)
  @MaxLength(512)
  originalName!: string;

  @Required()
  @Nullable(String)
  @MaxLength(255)
  mimeType!: string | null;

  @Required()
  @Nullable(Number)
  @Integer()
  @Minimum(0)
  sizeBytes!: number | null;

  @Required()
  @Nullable(String)
  @MaxLength(1024)
  storageKey!: string | null;

  @Required()
  @Nullable(String)
  @MaxLength(4000)
  notes!: string | null;
}

@AdditionalProperties({$ref: "#/components/schemas/HalLink"})
@Name("HalLinks")
export class SubmissionEventLinks {
  [relation: string]: HalLink;
}

@AdditionalProperties(false)
@Name("SubmissionEvent")
export class SubmissionEventResponse {
  @Required()
  @Pattern(/^[a-fA-F\d]{24}$/)
  @Property(String)
  documentId!: string;

  @Required()
  @Integer()
  @Minimum(1)
  @Property(Number)
  version!: number;

  @Required()
  @Format("date-time")
  @Property(String)
  submittedAt!: string;

  @Required()
  @Property(SubmissionEventMetadataResponse)
  metadata!: SubmissionEventMetadataResponse;

  @Required()
  @Property(SubmissionEventLinks)
  _links!: SubmissionEventLinks;
}

@AdditionalProperties(false)
export class SubmissionEventCollectionEmbedded {
  @Required()
  @CollectionOf(SubmissionEventResponse)
  "submission-events"!: SubmissionEventResponse[];
}

@AdditionalProperties(false)
@Name("SubmissionEventCollection")
export class SubmissionEventCollectionResponse {
  @Required()
  @Integer()
  @Minimum(0)
  @Property(Number)
  count!: number;

  @Required()
  @Property(SubmissionEventCollectionEmbedded)
  _embedded!: SubmissionEventCollectionEmbedded;

  @Required()
  @Property(PendingDocumentPageLinks)
  _links!: PendingDocumentPageLinks;
}
