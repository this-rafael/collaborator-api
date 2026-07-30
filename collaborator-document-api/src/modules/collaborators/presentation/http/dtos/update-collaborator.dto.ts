import {
  AdditionalProperties,
  Format,
  MaxLength,
  MinLength,
  MinProperties,
  Name,
  Pattern,
  Property
} from "@tsed/schema";

/** Contrato HTTP de alteração parcial de um colaborador. */
@AdditionalProperties(false)
@MinProperties(1)
@Name("CollaboratorPatchRequest")
export class UpdateCollaboratorDto {
  @Property(String)
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @Property(String)
  @Pattern(/^\d{11}$/)
  cpf?: string;

  @Property(String)
  @Format("email")
  @MaxLength(320)
  email?: string;
}
