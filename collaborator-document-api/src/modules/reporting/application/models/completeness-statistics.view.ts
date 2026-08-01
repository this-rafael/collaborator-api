/** Contagens agregadas dos vínculos documentais ativos. */
export type CompletenessCounts = Readonly<{
  totalActiveDocuments: number;
  submittedDocuments: number;
}>;

/** Resultado calculado da completude documental global. */
export type CompletenessStatisticsView = Readonly<
  CompletenessCounts & {
    pendingDocuments: number;
    percentage: number;
    calculatedAt: string;
  }
>;
