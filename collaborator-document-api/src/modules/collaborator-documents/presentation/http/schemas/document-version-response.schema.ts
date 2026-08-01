import {
  AdditionalProperties,
  Format,
  Integer,
  MaxLength,
  Minimum,
  MinLength,
  Name,
  Nullable,
  Property,
  Required
} from "@tsed/schema";

import {HalLink} from "../../../../../shared/presentation/http/schemas/hal-link.js";

@AdditionalProperties(false)
@Name("DocumentMetadata")
class DocumentMetadataResponse {
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
class DocumentVersionHalLinks {
  [relation: string]: HalLink;
}

/** Schema OpenAPI da representação HAL de uma versão documental. */
@AdditionalProperties(false)
@Name("DocumentVersion")
export class DocumentVersionResponse {
  @Required()
  @Integer()
  @Minimum(1)
  version!: number;

  @Required()
  @Property(String)
  @Format("date-time")
  submittedAt!: string;

  @Required()
  @Property(DocumentMetadataResponse)
  metadata!: DocumentMetadataResponse;

  @Required()
  @Property(DocumentVersionHalLinks)
  _links!: DocumentVersionHalLinks;
}
