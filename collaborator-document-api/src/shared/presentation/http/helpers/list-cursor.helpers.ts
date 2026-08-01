import {createHash} from "node:crypto";

import type {CursorCodec, CursorContext} from "../../../application/pagination/cursor-codec.js";

export function filtersHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function buildCursorContext(
  operationId: string,
  filters: unknown,
  order: string,
  limit: number
): CursorContext {
  return {operationId, filtersHash: filtersHash(filters), order, limit};
}

/** Decodifica cursor keyset; retorna afterId ou erro de campo. */
export function decodeAfterId(
  codec: CursorCodec,
  cursor: string | undefined,
  context: CursorContext
): {ok: true; afterId?: string} | {ok: false} {
  if (!cursor) return {ok: true};
  const decoded = codec.decode(cursor, context);
  if (decoded.isErr()) return {ok: false};
  return {ok: true, afterId: decoded.value.position.id};
}
