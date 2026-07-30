import {
  AdditionalProperties,
  MaxLength,
  MinLength,
  MinProperties,
  Name,
  Nullable,
  Pattern,
  Property
} from "@tsed/schema";

@AdditionalProperties(false)
@MinProperties(1)
@Name("DocumentTypePatchRequest")
export class UpdateDocumentTypeDto {
  @Property(String)
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @Property(String)
  @Pattern(/^[A-Z][A-Z0-9_]{1,63}$/)
  code?: string;

  @Nullable(String)
  @Property(String)
  @MaxLength(1000)
  description?: string | null;
}
