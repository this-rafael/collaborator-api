/** Projeção agregada de pendências para um tipo de documento. */
export type PendingDocumentTypeStatisticView = Readonly<{
  documentType: Readonly<{
    id: string;
    name: string;
    code: string;
  }>;
  pendingCount: number;
}>;

/** Posição total usada para continuar o ranking por keyset. */
export type PendingDocumentTypeStatisticPosition = Readonly<{
  pendingCount: number;
  documentTypeId: string;
}>;
