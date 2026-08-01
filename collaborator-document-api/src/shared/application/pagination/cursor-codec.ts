import type {Result} from "neverthrow";

/** Contexto que vincula um cursor à consulta que o emitiu. */
export type CursorContext = Readonly<{
  /** Identificador da operação que emitiu o cursor. */
  operationId: string;
  /** Hash dos filtros aplicados, garantindo que o cursor não seja reusado com outros filtros. */
  filtersHash: string;
  /** Ordem de ordenação da consulta (ex.: `asc` ou `desc`). */
  order: string;
  /** Tamanho da página associado ao cursor. */
  limit: number;
}>;

/** Posição em uma paginação keyset. */
export type CursorPosition = Readonly<{
  /** Identificador do último item da página, usado como âncora keyset. */
  id: string;
}>;

/**
 * Cursor validado, com metadados de versão e expiração.
 *
 * @remarks Combina o {@link CursorContext} com a versão do formato (`v`), a
 *   posição keyset e os instantes de emissão/expiração (em epoch ms).
 */
export type DecodedCursor = CursorContext &
  Readonly<{
    /** Versão do formato do cursor; atualmente sempre `1`. */
    v: 1;
    /** Posição keyset a partir da qual continuar a paginação. */
    position: CursorPosition;
    /** Instante de emissão do cursor (epoch em milissegundos). */
    issuedAt: number;
    /** Instante de expiração do cursor (epoch em milissegundos). */
    expiresAt: number;
  }>;

/** Porta de codificação de cursor independente do algoritmo de assinatura. */
export interface CursorCodec {
  /**
   * Codifica um cursor opaco e assinado a partir do contexto e da posição.
   *
   * @param input - Contexto da consulta somado à posição keyset a preservar.
   * @returns String de cursor opaca, segura para transporte ao cliente.
   */
  encode(input: CursorContext & Readonly<{position: CursorPosition}>): string;
  /**
   * Decodifica e valida um cursor contra o contexto esperado da consulta.
   *
   * @param cursor - Cursor opaco recebido do cliente.
   * @param expected - Contexto esperado (operação, filtros, ordem e limite)
   *   com o qual o cursor deve ser compatível.
   * @returns Result com o {@link DecodedCursor} em sucesso; em falha, o código
   *   literal `"INVALID_CURSOR"` quando a assinatura, o contexto ou a
   *   expiração não conferem.
   */
  decode(cursor: string, expected: CursorContext): Result<DecodedCursor, "INVALID_CURSOR">;
}
