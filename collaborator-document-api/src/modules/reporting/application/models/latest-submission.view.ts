/** Projeção corrente do último envio de um vínculo documental ativo. */
export type LatestSubmissionView = Readonly<{
  documentId: string;
  currentVersion: number;
  lastSubmittedAt: string;
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
export type LatestSubmissionPosition = Readonly<{
  lastSubmittedAt: string;
  id: string;
}>;
