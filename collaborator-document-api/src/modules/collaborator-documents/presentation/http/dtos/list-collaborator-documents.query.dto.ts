import {Optional, Property} from "@tsed/schema";

/** Parâmetros HTTP aceitos pela listagem de vínculos documentais. */
export class ListCollaboratorDocumentsQueryDto {
  @Optional()
  @Property(String)
  collaboratorId?: string;

  @Optional()
  @Property(String)
  documentTypeId?: string;

  @Optional()
  @Property(String)
  status?: string;

  @Optional()
  @Property(String)
  lifecycle?: string;

  @Optional()
  @Property(String)
  limit?: string;

  @Optional()
  @Property(String)
  cursor?: string;
}
