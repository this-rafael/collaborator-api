/**
 * Valores válidos para a variável de ambiente `NODE_ENV`.
 */
export const nodeEnvironments = ["development", "test", "production"] as const;
/**
 * Níveis de log suportados pelo logger do Ts.ED.
 */
export const logLevels = ["debug", "info", "warn", "error", "off"] as const;

/**
 * Ambiente de execução: development, test ou production.
 */
export type NodeEnvironment = (typeof nodeEnvironments)[number];
/**
 * Nível de log: debug, info, warn, error ou off.
 */
export type LogLevel = (typeof logLevels)[number];

/**
 * Configuração de rate limiting para as rotas da API.
 */
export type RateLimitConfig = Readonly<{
  /** Máximo de requisições de leitura permitidas na janela. */
  readLimit: number;
  /** Máximo de requisições de escrita permitidas na janela. */
  writeLimit: number;
  /** Tamanho da janela deslizante de contagem, em milissegundos. */
  windowMs: number;
}>;

/**
 * Configuração de CORS: lista de origens permitidas.
 */
export type CorsConfig = Readonly<{
  /** Origens (Origin) autorizadas a acessar a API. */
  allowlist: readonly string[];
}>;

/**
 * Configuração do endpoint de documentação OpenAPI.
 */
export type OpenApiConfig = Readonly<{
  /** Caminho HTTP onde o documento OpenAPI é publicado. */
  path: string;
  /** Versão da especificação OpenAPI (ex.: `3.1.0`). */
  specVersion: string;
}>;

/**
 * Agregado de configuração da aplicação composto a partir
 * de variáveis de ambiente.
 *
 * @remarks Objeto imutável gerado por {@link loadEnv}.
 */
export type AppEnv = Readonly<{
  /** Ambiente de execução ativo (development, test ou production). */
  nodeEnv: NodeEnvironment;
  /** Porta TCP em que o servidor HTTP escuta. */
  port: number;
  /** URI de conexão do MongoDB, já validada. */
  mongodbUri: string;
  /** Segredo HMAC usado para assinar cursores de paginação. */
  cursorHmacSecret: string;
  /** Nível de verbosidade do logger. */
  logLevel: LogLevel;
  /** Configuração de CORS derivada de `CORS_ALLOWLIST`. */
  cors: CorsConfig;
  /** Limites de taxa aplicados às rotas de leitura e escrita. */
  rateLimit: RateLimitConfig;
  /** Configuração do endpoint OpenAPI. */
  openapi: OpenApiConfig;
}>;

/**
 * Erro lançado quando uma ou mais variáveis de ambiente
 * obrigatórias estão ausentes ou com formato inválido.
 */
export class EnvironmentValidationError extends Error {
  /**
   * Cria o erro agregando todas as mensagens de validação.
   *
   * @param issues - Lista das inconsistências detectadas nas
   *   variáveis de ambiente, uma mensagem por problema.
   */
  constructor(readonly issues: readonly string[]) {
    super(`Invalid application environment: ${issues.join("; ")}`);
    this.name = "EnvironmentValidationError";
  }
}

function required(source: NodeJS.ProcessEnv, name: string, issues: string[]): string | undefined {
  const value = source[name]?.trim();
  if (!value) {
    issues.push(`${name} is required`);
    return undefined;
  }
  return value;
}

function optional(source: NodeJS.ProcessEnv, name: string, defaultValue: string): string {
  const value = source[name]?.trim();
  return value || defaultValue;
}

function isOneOf<T extends readonly string[]>(value: string, values: T): value is T[number] {
  return values.includes(value);
}

function validateMongodbUri(uri: string, issues: string[]): void {
  try {
    const parsed = new URL(uri);
    if (parsed.protocol !== "mongodb:" && parsed.protocol !== "mongodb+srv:") {
      issues.push("MONGODB_URI must use mongodb or mongodb+srv");
    }
    if (parsed.pathname === "/" || parsed.pathname === "") {
      issues.push("MONGODB_URI must include a database name");
    }
    if (parsed.protocol === "mongodb:" && !parsed.searchParams.get("replicaSet")) {
      issues.push("MONGODB_URI must include replicaSet for mongodb URLs");
    }
  } catch {
    issues.push("MONGODB_URI must be a valid URI");
  }
}

function validateRateLimits(
  source: NodeJS.ProcessEnv,
  issues: string[]
): {
  readLimit: number;
  writeLimit: number;
  windowMs: number;
} {
  const readLimit = Number(optional(source, "RATE_LIMIT_GET", "60"));
  if (!Number.isInteger(readLimit) || readLimit < 0) {
    issues.push("RATE_LIMIT_GET must be a non-negative integer");
  }

  const writeLimit = Number(optional(source, "RATE_LIMIT_WRITE", "20"));
  if (!Number.isInteger(writeLimit) || writeLimit < 0) {
    issues.push("RATE_LIMIT_WRITE must be a non-negative integer");
  }

  const windowMs = Number(optional(source, "RATE_LIMIT_WINDOW_MS", "60000"));
  if (!Number.isInteger(windowMs) || windowMs < 1000) {
    issues.push("RATE_LIMIT_WINDOW_MS must be at least 1000");
  }

  return {readLimit, writeLimit, windowMs};
}

/**
 * Lê e valida as variáveis de ambiente, retornando um objeto
 * de configuração tipado (`AppEnv`).
 *
 * Validações:
 * - `NODE_ENV` deve ser um dos valores de `nodeEnvironments`.
 * - `PORT` deve ser um inteiro entre 1 e 65535.
 * - `MONGODB_URI` deve ter protocolo `mongodb:` ou
 *   `mongodb+srv:`, incluir nome do banco e conter
 *   `replicaSet` para URLs `mongodb:`.
 * - `LOG_LEVEL` deve estar em `logLevels`.
 * - `RATE_LIMIT_GET` e `RATE_LIMIT_WRITE` devem ser inteiros não negativos.
 * - `RATE_LIMIT_WINDOW_MS` deve ser \>= 1000.
 *
 * @param source - Fonte das variáveis (default `process.env`).
 * @returns Configuração tipada e imutável da aplicação (`AppEnv`).
 * @throws EnvironmentValidationError Se houver um ou mais
 *   problemas de validação.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const issues: string[] = [];
  const rawNodeEnv = required(source, "NODE_ENV", issues);
  const rawPort = required(source, "PORT", issues);
  const mongodbUri = required(source, "MONGODB_URI", issues);
  const cursorHmacSecret = required(source, "CURSOR_HMAC_SECRET", issues);
  const rawLogLevel = required(source, "LOG_LEVEL", issues);

  if (rawNodeEnv && !isOneOf(rawNodeEnv, nodeEnvironments)) {
    issues.push("NODE_ENV must be development, test or production");
  }

  const port = Number(rawPort);
  if (!rawPort || !Number.isInteger(port) || port < 1 || port > 65535) {
    issues.push("PORT must be an integer between 1 and 65535");
  }

  if (rawLogLevel && !isOneOf(rawLogLevel, logLevels)) {
    issues.push("LOG_LEVEL is invalid");
  }

  if (mongodbUri) {
    validateMongodbUri(mongodbUri, issues);
  }

  if (cursorHmacSecret && Buffer.byteLength(cursorHmacSecret, "utf8") < 32) {
    issues.push("CURSOR_HMAC_SECRET must contain at least 32 bytes");
  }

  const rawCorsAllowlist = optional(source, "CORS_ALLOWLIST", "");
  const corsAllowlist = rawCorsAllowlist
    ? rawCorsAllowlist
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const {readLimit, writeLimit, windowMs} = validateRateLimits(source, issues);
  const rawOpenApiPath = optional(source, "OPENAPI_PATH", "/openapi.json");

  if (issues.length > 0) {
    throw new EnvironmentValidationError(issues);
  }

  return {
    nodeEnv: rawNodeEnv as NodeEnvironment,
    port,
    mongodbUri: mongodbUri!,
    cursorHmacSecret: cursorHmacSecret!,
    logLevel: rawLogLevel as LogLevel,
    cors: {
      allowlist: corsAllowlist
    },
    rateLimit: {
      readLimit,
      writeLimit,
      windowMs
    },
    openapi: {
      path: rawOpenApiPath,
      specVersion: "3.1.0"
    }
  };
}
