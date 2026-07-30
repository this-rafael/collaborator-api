import {createHmac, timingSafeEqual} from "node:crypto";
import {err, ok, type Result} from "neverthrow";

import type {
  CursorCodec,
  CursorContext,
  DecodedCursor
} from "../../application/pagination/cursor-codec.js";
import type {Clock} from "../../application/ports/clock.js";

/** Codec HMAC-SHA-256 para cursores keyset opacos e contextuais. */
export class HmacCursorCodec implements CursorCodec {
  constructor(
    private readonly secret: string,
    private readonly clock: Clock
  ) {}

  encode(input: CursorContext & {position: {id: string}}): string {
    const issuedAt = this.clock.now().getTime();
    const payload: DecodedCursor = {v: 1, ...input, issuedAt, expiresAt: issuedAt + 15 * 60_000};
    const encoded = Buffer.from(this.canonicalJson(payload)).toString("base64url");
    return `${encoded}.${this.sign(encoded)}`;
  }

  decode(cursor: string, expected: CursorContext): Result<DecodedCursor, "INVALID_CURSOR"> {
    const [encoded, signature, extra] = cursor.split(".");
    if (!encoded || !signature || extra || !this.sameSignature(signature, this.sign(encoded))) {
      return err("INVALID_CURSOR");
    }
    try {
      const payload = JSON.parse(
        Buffer.from(encoded, "base64url").toString("utf8")
      ) as DecodedCursor;
      if (
        payload.v !== 1 ||
        !payload.position?.id ||
        !Number.isFinite(payload.issuedAt) ||
        !Number.isFinite(payload.expiresAt) ||
        payload.expiresAt <= this.clock.now().getTime() ||
        !this.sameContext(payload, expected)
      ) {
        return err("INVALID_CURSOR");
      }
      return ok(payload);
    } catch {
      return err("INVALID_CURSOR");
    }
  }

  private sign(value: string): string {
    return createHmac("sha256", this.secret).update(value).digest("base64url");
  }

  private sameSignature(left: string, right: string): boolean {
    const a = Buffer.from(left);
    const b = Buffer.from(right);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  private sameContext(payload: DecodedCursor, expected: CursorContext): boolean {
    return (
      payload.operationId === expected.operationId &&
      payload.filtersHash === expected.filtersHash &&
      payload.order === expected.order &&
      payload.limit === expected.limit
    );
  }

  private canonicalJson(payload: DecodedCursor): string {
    return JSON.stringify({
      expiresAt: payload.expiresAt,
      filtersHash: payload.filtersHash,
      issuedAt: payload.issuedAt,
      limit: payload.limit,
      operationId: payload.operationId,
      order: payload.order,
      position: {id: payload.position.id},
      v: payload.v
    });
  }
}
