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
  limit: number;
  windowMs: number;
}>;

/**
 * Configuração de CORS: lista de origens permitidas.
 */
export type CorsConfig = Readonly<{
  allowlist: readonly string[];
}>;

/**
 * Configuração do endpoint de documentação OpenAPI.
 */
export type OpenApiConfig = Readonly<{
  path: string;
  specVersion: string;
}>;

/**
 * Agregado de configuração da aplicação composto a partir
 * de variáveis de ambiente.
 *
 * @remarks Objeto imutável gerado por {@link loadEnv}.
 */
export type AppEnv = Readonly<{
  nodeEnv: NodeEnvironment;
  port: number;
  mongodbUri: string;
  cursorHmacSecret: string;
  logLevel: LogLevel;
  cors: CorsConfig;
  rateLimit: RateLimitConfig;
  openapi: OpenApiConfig;
}>;

/**
 * Erro lançado quando uma ou mais variáveis de ambiente
 * obrigatórias estão ausentes ou com formato inválido.
 */
export class EnvironmentValidationError extends Error {
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
 * - `RATE_LIMIT_GET` deve ser inteiro não negativo.
 * - `RATE_LIMIT_WINDOW_MS` deve ser >= 1000.
 *
 * @param source - Fonte das variáveis (default `process.env`).
 * @returns Configuração tipada da aplicação.
 * @throws {EnvironmentValidationError} Se houver um ou mais
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
    try {
      const uri = new URL(mongodbUri);
      if (uri.protocol !== "mongodb:" && uri.protocol !== "mongodb+srv:") {
        issues.push("MONGODB_URI must use mongodb or mongodb+srv");
      }
      if (uri.pathname === "/" || uri.pathname === "") {
        issues.push("MONGODB_URI must include a database name");
      }
      if (uri.protocol === "mongodb:" && !uri.searchParams.get("replicaSet")) {
        issues.push("MONGODB_URI must include replicaSet for mongodb URLs");
      }
    } catch {
      issues.push("MONGODB_URI must be a valid URI");
    }
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

  const rawRateLimit = optional(source, "RATE_LIMIT_GET", "60");
  const rateLimitNumber = Number(rawRateLimit);
  if (!Number.isInteger(rateLimitNumber) || rateLimitNumber < 0) {
    issues.push("RATE_LIMIT_GET must be a non-negative integer");
  }

  const rawRateWindow = optional(source, "RATE_LIMIT_WINDOW_MS", "60000");
  const rateWindowNumber = Number(rawRateWindow);
  if (!Number.isInteger(rateWindowNumber) || rateWindowNumber < 1000) {
    issues.push("RATE_LIMIT_WINDOW_MS must be at least 1000");
  }

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
      limit: rateLimitNumber,
      windowMs: rateWindowNumber
    },
    openapi: {
      path: rawOpenApiPath,
      specVersion: "3.1.0"
    }
  };
}
