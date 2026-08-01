/**
 * Contrato público da cascata de soft delete de vínculos documentais.
 *
 * @remarks
 * Consumido pelos módulos donos de colaboradores e tipos de documento para
 * propagar a exclusão lógica aos vínculos dentro de uma mesma transação.
 */

/** Dados públicos para a cascata de exclusão de vínculos de um colaborador. */
export type SoftDeleteCollaboratorDocumentsInput = Readonly<{
  collaboratorId: string;
  deletedAt: string;
}>;

/**
 * Falhas técnicas que a cascata pode devolver ao módulo consumidor.
 *
 * @remarks
 * Restringe-se a falhas de infraestrutura (SERVICE_UNAVAILABLE,
 * INTERNAL_SERVER_ERROR), pois erros de negócio não se aplicam à cascata.
 */
export type CollaboratorDocumentsFailure = Readonly<{
  kind: "application";
  code: "SERVICE_UNAVAILABLE" | "INTERNAL_SERVER_ERROR";
  message: string;
}>;

/**
 * Cria uma falha técnica da cascata de documentos.
 *
 * @param code - Código da falha (SERVICE_UNAVAILABLE ou INTERNAL_SERVER_ERROR).
 * @param message - Mensagem legível descrevendo o problema.
 * @returns Falha de aplicação pronta para uso em um `Result`.
 */
export const collaboratorDocumentsFailure = (
  code: CollaboratorDocumentsFailure["code"],
  message: string
): CollaboratorDocumentsFailure => ({kind: "application", code, message});
