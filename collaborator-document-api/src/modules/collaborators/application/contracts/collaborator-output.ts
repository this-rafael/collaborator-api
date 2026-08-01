/**
 * Contratos de saída da aplicação de colaboradores.
 *
 * Definem a representação primitiva exposta pela aplicação e o mapeamento a
 * partir do agregado, impedindo que Value Objects vazem para as camadas
 * externas.
 */
import type {Collaborator} from "../../domain/entities/collaborator.js";

/** Representação primitiva de um colaborador na fronteira da aplicação. */
export type CollaboratorOutput = Readonly<{
  id: string;
  name: string;
  cpf: string;
  email: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}>;

/** Página primitiva de colaboradores ativos. */
export type ListCollaboratorsOutput = Readonly<{
  items: readonly CollaboratorOutput[];
  hasNext: boolean;
  filters: Readonly<{name?: string; cpf?: string; email?: string}>;
}>;

/**
 * Converte o agregado sem deixar Value Objects atravessarem a aplicação.
 *
 * @param collaborator - Agregado de colaborador a ser projetado.
 * @returns Objeto imutável `CollaboratorOutput` com valores primitivos e datas
 * serializadas em ISO 8601 (`deletedAt` fica `null` quando o colaborador está ativo).
 */
export const collaboratorToOutput = (collaborator: Collaborator): CollaboratorOutput => {
  const {id, name, cpf, email, createdAt, updatedAt, deletedAt} = collaborator.props;
  return Object.freeze({
    id,
    name: name.value,
    cpf: cpf.value,
    email: email.value,
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
    deletedAt: deletedAt?.toISOString() ?? null
  });
};
