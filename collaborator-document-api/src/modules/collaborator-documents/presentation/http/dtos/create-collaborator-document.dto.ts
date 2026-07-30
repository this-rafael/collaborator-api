import {AdditionalProperties, Name, Pattern, Property, Required} from "@tsed/schema";

/** Dados de requisição para criar um vínculo documental. */
@AdditionalProperties(false)
@Name("CollaboratorDocumentCreateRequest")
export class CreateCollaboratorDocumentDto {
  @Required()
  @Property(String)
  @Pattern(/^[a-fA-F0-9]{24}$/)
  collaboratorId!: string;

  @Required()
  @Property(String)
  @Pattern(/^[a-fA-F0-9]{24}$/)
  documentTypeId!: string;
}
