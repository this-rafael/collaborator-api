import {
  AdditionalProperties,
  Format,
  MaxLength,
  MinLength,
  Name,
  Pattern,
  Property,
  Required
} from "@tsed/schema";

/** Contrato HTTP de criação de um colaborador. */
@AdditionalProperties(false)
@Name("CollaboratorCreateRequest")
export class CreateCollaboratorDto {
  @Required()
  @Property(String)
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @Required()
  @Property(String)
  @Pattern(/^\d{11}$/)
  cpf!: string;

  @Required()
  @Property(String)
  @Format("email")
  @MaxLength(320)
  email!: string;
}
