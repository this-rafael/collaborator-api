/**
 * Falha de regra de domínio serializável e discriminada.
 *
 * Falhas de domínio viajam em `Result` / `Promise<Result>`; elas não são exceções.
 */
export type DomainFailure<TCode extends string = string> = Readonly<{
  kind: "domain";
  code: TCode;
  message: string;
}>;

/** Cria uma falha de domínio imutável. */
export const domainFailure = <TCode extends string>(
  code: TCode,
  message: string
): DomainFailure<TCode> => Object.freeze({kind: "domain" as const, code, message});

/** Verifica se um valor é uma falha de domínio. */
export const isDomainFailure = (value: unknown): value is DomainFailure => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<DomainFailure>;
  return (
    candidate.kind === "domain" &&
    typeof candidate.code === "string" &&
    typeof candidate.message === "string"
  );
};
