import {err, ok, type Result} from "neverthrow";

/**
 * Re-exporta os tipos e helpers do `neverthrow` para
 * conveniência do módulo compartilhado.
 */
export {err, ok, Result};

/**
 * Envolve um valor em um `Result` de sucesso (tipo erro =
 * `never`).
 *
 * @typeParam T - Tipo do valor de sucesso.
 * @param value - Valor a ser envelopado.
 * @returns `ok(value)`.
 */
export const success = <T>(value: T): Result<T, never> => ok(value);

/**
 * Envolve um erro em um `Result` de falha (tipo sucesso =
 * `never`).
 *
 * @typeParam E - Tipo do erro.
 * @param error - Erro a ser envelopado.
 * @returns `err(error)`.
 */
export const failure = <E>(error: E): Result<never, E> => err(error);
