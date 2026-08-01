import {
  Default,
  Integer,
  Maximum,
  Minimum,
  MinLength,
  Optional,
  Pattern,
  Property
} from "@tsed/schema";

/** Parâmetros HTTP aceitos pela listagem de documentos pendentes. */
export class ListPendingDocumentsQueryDto {
  @Optional()
  @Property(String)
  collaboratorName?: string;

  @Optional()
  @Property(String)
  @Pattern(/^\d{11}$/)
  cpf?: string;

  @Optional()
  @Property(String)
  documentTypeName?: string;

  @Optional()
  @Property(String)
  @Pattern(/^[A-Z][A-Z0-9_]{1,63}$/)
  documentTypeCode?: string;

  @Optional()
  @Property(Number)
  @Integer()
  @Minimum(1)
  @Maximum(100)
  @Default(20)
  limit?: string;

  @Optional()
  @Property(String)
  @MinLength(1)
  cursor?: string;
}
