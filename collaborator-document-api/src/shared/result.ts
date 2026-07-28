import {err, ok, type Result, type ResultAsync} from "neverthrow";

export {err, ok, Result, ResultAsync};

export const success = <T>(value: T): Result<T, never> => ok(value);

export const failure = <E>(error: E): Result<never, E> => err(error);
