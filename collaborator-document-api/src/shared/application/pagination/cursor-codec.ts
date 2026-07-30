import type {Result} from "neverthrow";

/** Contexto que vincula um cursor à consulta que o emitiu. */
export type CursorContext = Readonly<{
  operationId: string;
  filtersHash: string;
  order: string;
  limit: number;
}>;

/** Posição em uma paginação keyset. */
export type CursorPosition = Readonly<{id: string}>;

/** Cursor validado, com metadados de versão e expiração. */
export type DecodedCursor = CursorContext &
  Readonly<{v: 1; position: CursorPosition; issuedAt: number; expiresAt: number}>;

/** Porta de codificação de cursor independente do algoritmo de assinatura. */
export interface CursorCodec {
  encode(input: CursorContext & Readonly<{position: CursorPosition}>): string;
  decode(cursor: string, expected: CursorContext): Result<DecodedCursor, "INVALID_CURSOR">;
}
