/** Parâmetros HTTP aceitos pela listagem de colaboradores. */
export class ListCollaboratorsQueryDto {
  name?: string;
  cpf?: string;
  email?: string;
  limit?: string;
  cursor?: string;
}
