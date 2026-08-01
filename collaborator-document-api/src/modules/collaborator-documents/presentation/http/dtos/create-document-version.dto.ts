import {
  AdditionalProperties,
  Default,
  Any,
  MaxLength,
  MinLength,
  Name,
  Nullable,
  Property,
  Required
} from "@tsed/schema";

@AdditionalProperties(false)
@Name("VersionCreateMetadata")
class CreateDocumentVersionMetadataDto {
  @Required()
  @Property(String)
  @MinLength(1)
  @MaxLength(512)
  originalName!: string;

  @Nullable(String)
  @Default(null)
  @MaxLength(255)
  mimeType?: string | null;

  @Any()
  @Default(null)
  sizeBytes?: unknown;

  @Nullable(String)
  @Default(null)
  @MaxLength(1024)
  storageKey?: string | null;

  @Nullable(String)
  @Default(null)
  @MaxLength(4000)
  notes?: string | null;
}

/** Corpo para enviar ou reenviar uma versão documental. */
@AdditionalProperties(false)
@Name("VersionCreateRequest")
export class CreateDocumentVersionDto {
  @Required()
  @Property(CreateDocumentVersionMetadataDto)
  metadata!: CreateDocumentVersionMetadataDto;
}
