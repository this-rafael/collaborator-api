/**
 * Falha operacional serializável e discriminada.
 *
 * @typeParam TCode - União literal dos códigos de falha suportados.
 * @remarks A aplicação a devolve por `Result` / `Promise<Result>`, sem lançar
 *   erros técnicos através das fronteiras de caso de uso.
 */
export type ApplicationFailure<TCode extends string = string> = Readonly<{
  /** Discriminador da união; sempre `"application"`. */
  kind: "application";
  /** Código estável que identifica a categoria da falha operacional. */
  code: TCode;
  /** Mensagem legível descrevendo a falha. */
  message: string;
}>;

/**
 * Cria uma falha de aplicação imutável (congelada).
 *
 * @typeParam TCode - Código literal específico da falha.
 * @param code - Código estável que identifica a categoria da falha.
 * @param message - Mensagem legível descrevendo a falha.
 * @returns Objeto `ApplicationFailure` imutável.
 */
export const applicationFailure = <TCode extends string>(
  code: TCode,
  message: string
): ApplicationFailure<TCode> => Object.freeze({kind: "application" as const, code, message});

/**
 * Verifica, via type guard, se um valor é uma falha de aplicação.
 *
 * @param value - Valor arbitrário a ser inspecionado.
 * @returns `true` (com refinamento de tipo para `ApplicationFailure`) quando o
 *   valor possui a forma esperada; caso contrário, `false`.
 */
export const isApplicationFailure = (value: unknown): value is ApplicationFailure => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ApplicationFailure>;
  return (
    candidate.kind === "application" &&
    typeof candidate.code === "string" &&
    typeof candidate.message === "string"
  );
};
