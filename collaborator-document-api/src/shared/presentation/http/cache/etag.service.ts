import {createHash} from "node:crypto";

const TRACE_KEYS = new Set([
  "traceId",
  "traceid",
  "requestId",
  "requestid",
  "generatedAt",
  "headers"
]);

/**
 * Serializa um valor para JSON canônico, ignorando chaves
 * de trace (`traceId`, `generatedAt`, etc.) para produzir
 * ETags consistentes.
 */
function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }
  const keys = Object.keys(value as Record<string, unknown>)
    .filter((k) => !TRACE_KEYS.has(k))
    .sort((a, b) => a.localeCompare(b));
  const entries = keys.map((k) => {
    const val = canonicalize((value as Record<string, unknown>)[k]);
    return `${JSON.stringify(k)}:${val}`;
  });
  return `{${entries.join(",")}}`;
}

/**
 * Serviço de geração e comparação de ETags fracas.
 *
 * Gera ETags no formato `W/"sha256:<hex>"` a partir de
 * hashing SHA-256 do payload canônico (excluindo campos
 * de trace).
 */
export class EtagService {
  /**
   * Calcula a ETag fraca de um payload semântico.
   *
   * @param payload - Valor a ser hasheado; campos de trace são ignorados na
   *   canonicalização para manter a ETag estável.
   * @returns ETag no formato `W/"sha256:<hex>"`.
   */
  compute(payload: unknown): string {
    const hash = createHash("sha256").update(canonicalize(payload)).digest("hex");
    return `W/"sha256:${hash}"`;
  }

  /**
   * Compara a ETag do servidor com a informada pelo cliente.
   *
   * @param serverTag - ETag calculada pelo servidor.
   * @param clientTag - ETag recebida no cabeçalho `If-None-Match`.
   * @returns `true` quando as ETags são idênticas (recurso não modificado).
   */
  matches(serverTag: string, clientTag: string): boolean {
    return serverTag === clientTag;
  }
}
