/**
 * Falha operacional serializável e discriminada.
 *
 * A aplicação a devolve por `Result` / `Promise<Result>`, sem lançar erros técnicos
 * através das fronteiras de caso de uso.
 */
export type ApplicationFailure<TCode extends string = string> = Readonly<{
  kind: "application";
  code: TCode;
  message: string;
}>;

/** Cria uma falha de aplicação imutável. */
export const applicationFailure = <TCode extends string>(
  code: TCode,
  message: string
): ApplicationFailure<TCode> => Object.freeze({kind: "application" as const, code, message});

/** Verifica se um valor é uma falha de aplicação. */
export const isApplicationFailure = (value: unknown): value is ApplicationFailure => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ApplicationFailure>;
  return (
    candidate.kind === "application" &&
    typeof candidate.code === "string" &&
    typeof candidate.message === "string"
  );
};
