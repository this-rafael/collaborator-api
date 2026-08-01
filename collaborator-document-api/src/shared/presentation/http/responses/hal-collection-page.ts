import type {CursorCodec, CursorContext} from "../../../application/pagination/cursor-codec.js";

/** Monta self/next hrefs e corpo HAL de uma coleção paginada. */
export function buildHalCollectionPage<TItem>(options: {
  items: readonly TItem[];
  hasNext: boolean;
  lastId: string | undefined;
  filters: Readonly<Record<string, string | undefined>>;
  limit: number;
  cursor: string | undefined;
  route: string;
  embeddedKey: string;
  context: CursorContext;
  codec: CursorCodec;
}): {
  count: number;
  _embedded: Record<string, readonly TItem[]>;
  _links: {self: {href: string}; next?: {href: string}};
} {
  const selfQuery = new URLSearchParams();
  for (const [key, value] of Object.entries(options.filters)) {
    if (value) selfQuery.set(key, value);
  }
  selfQuery.set("limit", String(options.limit));
  if (options.cursor) selfQuery.set("cursor", options.cursor);
  const self = `${options.route}?${selfQuery.toString()}`;
  const next =
    options.hasNext && options.lastId
      ? (() => {
          const nextQuery = new URLSearchParams(selfQuery);
          nextQuery.set(
            "cursor",
            options.codec.encode({...options.context, position: {id: options.lastId}})
          );
          return `${options.route}?${nextQuery.toString()}`;
        })()
      : undefined;
  return {
    count: options.items.length,
    _embedded: {[options.embeddedKey]: options.items},
    _links: next ? {self: {href: self}, next: {href: next}} : {self: {href: self}}
  };
}
