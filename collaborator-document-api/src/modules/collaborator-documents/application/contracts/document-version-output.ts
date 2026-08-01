/** Metadados lógicos persistidos com uma versão documental. */
export type DocumentVersionMetadata = Readonly<{
  originalName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  storageKey: string | null;
  notes: string | null;
}>;

/** Saída primitiva de uma versão documental criada. */
export type DocumentVersionOutput = Readonly<{
  version: number;
  submittedAt: string;
  metadata: DocumentVersionMetadata;
}>;
