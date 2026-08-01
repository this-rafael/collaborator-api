import type {Response} from "express";

import type {EtagService} from "../cache/etag.service.js";

/** Responde 304 sem corpo e limpa headers de conteúdo. */
export function writeNotModified(res: Response): void {
  res.status(304);
  res.removeHeader("Content-Type");
  res.removeHeader("Content-Length");
  res.end();
}

/**
 * Escreve coleção HAL+JSON com ETag, ou 304 quando If-None-Match coincide.
 */
export function writeHalWithEtag(
  res: Response,
  body: unknown,
  etag: EtagService,
  ifNoneMatch: string | undefined
): void {
  const tag = etag.compute(body);
  if (ifNoneMatch && etag.matches(tag, ifNoneMatch)) {
    writeNotModified(res);
    return;
  }
  res.setHeader("ETag", tag);
  res.status(200).type("application/hal+json").json(body);
}
