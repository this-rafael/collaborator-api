import {
  AdditionalProperties,
  MaxLength,
  MinLength,
  Name,
  Nullable,
  Pattern,
  Property,
  Required
} from "@tsed/schema";

@AdditionalProperties(false)
@Name("DocumentTypeCreateRequest")
export class CreateDocumentTypeDto {
  @Required()
  @Property(String)
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @Required()
  @Property(String)
  @Pattern(/^[A-Z][A-Z0-9_]{1,63}$/)
  code!: string;

  @Nullable(String)
  @Property(String)
  @MaxLength(1000)
  description?: string | null;
}
