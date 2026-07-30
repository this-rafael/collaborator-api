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

@AdditionalProperties({$ref: "#/components/schemas/HalLink"})
@Name("DocumentTypeHalLinks")
export class DocumentTypeHalLinks {
  [relation: string]: HalLink;
}

@AdditionalProperties({$ref: "#/components/schemas/HalLink"})
@Name("DocumentTypePageLinks")
export class DocumentTypePageLinks {
  @Required()
  @Property(HalLink)
  self!: HalLink;

  @Property(HalLink)
  next?: HalLink;
}

@AdditionalProperties(false)
@Name("DocumentType")
export class DocumentTypeResponse {
  @Required()
  @Property(String)
  @Pattern(/^[a-f\d]{24}$/i)
  id!: string;

  @Required()
  @Property(String)
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @Required()
  @Property(String)
  @Pattern(/^[A-Z][A-Z0-9_]{1,63}$/)
  code!: string;

  @Required()
  @Nullable(String)
  @MaxLength(1000)
  description!: string | null;

  @Required()
  @Property(String)
  @Format("date-time")
  createdAt!: string;

  @Required()
  @Property(String)
  @Format("date-time")
  updatedAt!: string;

  @Required()
  @Nullable(String)
  @Format("date-time")
  deletedAt!: string | null;

  @Required()
  @Property(DocumentTypeHalLinks)
  _links!: DocumentTypeHalLinks;
}

@AdditionalProperties(false)
export class DocumentTypeCollectionEmbedded {
  @Required()
  @CollectionOf(DocumentTypeResponse)
  documentTypes!: DocumentTypeResponse[];
}

@AdditionalProperties(false)
@Name("DocumentTypeCollection")
export class DocumentTypeCollectionResponse {
  @Required()
  @Integer()
  @Minimum(0)
  @Property(Number)
  count!: number;

  @Required()
  @Property(DocumentTypeCollectionEmbedded)
  _embedded!: DocumentTypeCollectionEmbedded;

  @Required()
  @Property(DocumentTypePageLinks)
  _links!: DocumentTypePageLinks;
}
