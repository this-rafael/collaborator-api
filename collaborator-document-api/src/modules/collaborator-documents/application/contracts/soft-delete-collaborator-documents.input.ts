/** Dados públicos para a cascata de exclusão de vínculos de um colaborador. */
export type SoftDeleteCollaboratorDocumentsInput = Readonly<{
  collaboratorId: string;
  deletedAt: string;
}>;

/** Falhas técnicas que a cascata pode devolver ao módulo consumidor. */
export type CollaboratorDocumentsFailure = Readonly<{
  kind: "application";
  code: "SERVICE_UNAVAILABLE" | "INTERNAL_SERVER_ERROR";
  message: string;
}>;

export const collaboratorDocumentsFailure = (
  code: CollaboratorDocumentsFailure["code"],
  message: string
): CollaboratorDocumentsFailure => ({kind: "application", code, message});
