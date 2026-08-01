/** Projeção de uma versão individual no histórico de envios. */
export type SubmissionEventView = Readonly<{
  documentId: string;
  version: number;
  submittedAt: string;
  metadata: Readonly<{
    originalName: string;
    mimeType: string | null;
    sizeBytes: number | null;
    storageKey: string | null;
    notes: string | null;
  }>;
}>;

/** Posição total usada para continuar a ordenação keyset. */
export type SubmissionEventPosition = Readonly<{
  submittedAt: string;
  documentId: string;
  version: number;
}>;
