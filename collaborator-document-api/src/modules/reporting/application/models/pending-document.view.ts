/** Projeção mínima de uma pendência, independente de transporte e persistência. */
export type PendingDocumentView = Readonly<{
  id: string;
  status: "PENDING";
  linkedAt: string;
  collaborator: Readonly<{
    id: string;
    name: string;
    cpf?: string;
  }>;
  documentType: Readonly<{
    id: string;
    name: string;
    code: string;
  }>;
}>;

/** Posição total usada para continuar a ordenação keyset. */
export type PendingDocumentPosition = Readonly<{
  documentTypeId: string;
  collaboratorId: string;
  id: string;
}>;
