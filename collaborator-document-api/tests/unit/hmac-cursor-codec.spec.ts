import {describe, expect, it} from "vitest";

import {cursorClock, cursorSecret} from "../helpers/cursor-runtime.js";

// COL-LIST-009…020, CURSOR-001, CURSOR-002
describe("Signing list cursors", () => {
  it("signs verifies and rejects altered cursors using constant-time validation", async () => {
    const {HmacCursorCodec} =
      await import("../../src/shared/application/services/hmac-cursor-codec.js");
    const codec = new HmacCursorCodec(cursorSecret, cursorClock());
    const cursor = codec.encode({
      operationId: "listCollaborators",
      filtersHash: "hash",
      order: "name",
      limit: 20,
      position: {id: "66a64ab05bd7213b90d9b001"}
    });
    expect(
      codec
        .decode(cursor, {
          operationId: "listCollaborators",
          filtersHash: "hash",
          order: "name",
          limit: 20
        })
        .isOk()
    ).toBe(true);
    expect(
      codec
        .decode(`${cursor}x`, {
          operationId: "listCollaborators",
          filtersHash: "hash",
          order: "name",
          limit: 20
        })
        .isErr()
    ).toBe(true);
  });

  it("rejects expired and context-incompatible cursors", async () => {
    const {HmacCursorCodec} =
      await import("../../src/shared/application/services/hmac-cursor-codec.js");
    const clock = cursorClock();
    const codec = new HmacCursorCodec(cursorSecret, clock);
    const cursor = codec.encode({
      operationId: "listCollaborators",
      filtersHash: "hash",
      order: "name",
      limit: 20,
      position: {id: "66a64ab05bd7213b90d9b001"}
    });
    clock.advance(15 * 60 * 1000 + 1);
    expect(
      codec
        .decode(cursor, {
          operationId: "listCollaborators",
          filtersHash: "different",
          order: "name",
          limit: 20
        })
        .isErr()
    ).toBe(true);
  });

  it("rejects cursors whose payload is not valid JSON", async () => {
    const {createHmac} = await import("node:crypto");
    const {HmacCursorCodec} =
      await import("../../src/shared/application/services/hmac-cursor-codec.js");
    const codec = new HmacCursorCodec(cursorSecret, cursorClock());
    const encoded = Buffer.from("not-json").toString("base64url");
    const signature = createHmac("sha256", cursorSecret).update(encoded).digest("base64url");
    expect(
      codec
        .decode(`${encoded}.${signature}`, {
          operationId: "listCollaborators",
          filtersHash: "hash",
          order: "name",
          limit: 20
        })
        .isErr()
    ).toBe(true);
  });
});
