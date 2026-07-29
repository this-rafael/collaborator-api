import type {Result} from "neverthrow";

/**
 * Contexto usado para codificar/decodificar um cursor de
 * paginação keyset.
 */
export type CursorContext = Readonly<{
  operationId: string;
  filtersHash: string;
  order: string;
  limit: number;
}>;

/**
 * Posição em um cursor de paginação keyset.
 */
export type CursorPosition = Readonly<{id: string}>;

/**
 * Payload completo de um cursor decodificado, incluindo
 * metadados de versão e expiração.
 */
export type DecodedCursor = CursorContext &
  Readonly<{v: 1; position: CursorPosition; issuedAt: number; expiresAt: number}>;

/**
 * Porta para codec de cursor de paginação keyset.
 *
 * Define o contrato para codificar (serializar + assinar)
 * e decodificar (verificar assinatura + validar) cursores
 * de paginação.
 */
export interface CursorCodec {
  encode(input: CursorContext & Readonly<{position: CursorPosition}>): string;
  decode(cursor: string, expected: CursorContext): Result<DecodedCursor, "INVALID_CURSOR">;
}
