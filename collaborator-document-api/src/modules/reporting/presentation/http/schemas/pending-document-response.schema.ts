import {
  AdditionalProperties,
  CollectionOf,
  Const,
  Format,
  Integer,
  Minimum,
  Name,
  Pattern,
  Property,
  Required
} from "@tsed/schema";

import {HalLink} from "../../../../../shared/presentation/http/schemas/hal-link.js";

@AdditionalProperties(false)
@Name("CollaboratorSummary")
export class CollaboratorSummaryResponse {
  @Required()
  @Pattern(/^[a-fA-F\d]{24}$/)
  @Property(String)
  id!: string;

  @Required()
  @Property(String)
  name!: string;

  @Pattern(/^\d{11}$/)
  @Property(String)
  cpf?: string;
}

@AdditionalProperties(false)
@Name("DocumentTypeSummary")
export class DocumentTypeSummaryResponse {
  @Required()
  @Pattern(/^[a-fA-F\d]{24}$/)
  @Property(String)
  id!: string;

  @Required()
  @Property(String)
  name!: string;

  @Required()
  @Property(String)
  code!: string;
}

@AdditionalProperties({$ref: "#/components/schemas/HalLink"})
export class PendingDocumentLinks {
  [relation: string]: HalLink;
}

@AdditionalProperties(false)
@Name("PendingDocument")
export class PendingDocumentResponse {
  @Required()
  @Pattern(/^[a-fA-F\d]{24}$/)
  @Property(String)
  id!: string;

  @Required()
  @Const("PENDING")
  @Property(String)
  status!: "PENDING";

  @Required()
  @Format("date-time")
  @Property(String)
  linkedAt!: string;

  @Required()
  @Property(CollaboratorSummaryResponse)
  collaborator!: CollaboratorSummaryResponse;

  @Required()
  @Property(DocumentTypeSummaryResponse)
  documentType!: DocumentTypeSummaryResponse;

  @Required()
  @Property(PendingDocumentLinks)
  _links!: PendingDocumentLinks;
}

@AdditionalProperties(false)
export class PendingDocumentCollectionEmbedded {
  @Required()
  @CollectionOf(PendingDocumentResponse)
  "pending-documents"!: PendingDocumentResponse[];
}

@AdditionalProperties({$ref: "#/components/schemas/HalLink"})
@Name("PageLinks")
export class PendingDocumentPageLinks {
  @Required()
  @Property(HalLink)
  self!: HalLink;

  @Property(HalLink)
  next?: HalLink;
}

@AdditionalProperties(false)
@Name("PendingDocumentCollection")
export class PendingDocumentCollectionResponse {
  @Required()
  @Integer()
  @Minimum(0)
  @Property(Number)
  count!: number;

  @Required()
  @Property(PendingDocumentCollectionEmbedded)
  _embedded!: PendingDocumentCollectionEmbedded;

  @Required()
  @Property(PendingDocumentPageLinks)
  _links!: PendingDocumentPageLinks;
}
