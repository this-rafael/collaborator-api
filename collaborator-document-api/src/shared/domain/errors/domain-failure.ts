/**
 * Falha de regra de domínio serializável e discriminada.
 *
 * @typeParam TCode - União literal dos códigos de falha suportados pelo módulo.
 * @remarks Falhas de domínio viajam em `Result` / `Promise<Result>`; elas não
 *   são exceções e nunca são lançadas.
 */
export type DomainFailure<TCode extends string = string> = Readonly<{
  /** Discriminador da união; sempre `"domain"`. */
  kind: "domain";
  /** Código estável que identifica a categoria da falha. */
  code: TCode;
  /** Mensagem legível descrevendo a violação de regra de domínio. */
  message: string;
}>;

/**
 * Cria uma falha de domínio imutável (congelada).
 *
 * @typeParam TCode - Código literal específico da falha.
 * @param code - Código estável que identifica a categoria da falha.
 * @param message - Mensagem legível descrevendo a violação.
 * @returns Objeto `DomainFailure` imutável.
 */
export const domainFailure = <TCode extends string>(
  code: TCode,
  message: string
): DomainFailure<TCode> => Object.freeze({kind: "domain" as const, code, message});

/**
 * Verifica, via type guard, se um valor é uma falha de domínio.
 *
 * @param value - Valor arbitrário a ser inspecionado.
 * @returns `true` (com refinamento de tipo para `DomainFailure`) quando o valor
 *   possui a forma esperada; caso contrário, `false`.
 */
export const isDomainFailure = (value: unknown): value is DomainFailure => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<DomainFailure>;
  return (
    candidate.kind === "domain" &&
    typeof candidate.code === "string" &&
    typeof candidate.message === "string"
  );
};
