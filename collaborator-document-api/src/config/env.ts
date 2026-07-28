export const nodeEnvironments = ["development", "test", "production"] as const;
export const logLevels = ["debug", "info", "warn", "error", "off"] as const;

export type NodeEnvironment = (typeof nodeEnvironments)[number];
export type LogLevel = (typeof logLevels)[number];

export type AppEnv = Readonly<{
  nodeEnv: NodeEnvironment;
  port: number;
  mongodbUri: string;
  logLevel: LogLevel;
}>;

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

function isOneOf<T extends readonly string[]>(value: string, values: T): value is T[number] {
  return values.includes(value);
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const issues: string[] = [];
  const rawNodeEnv = required(source, "NODE_ENV", issues);
  const rawPort = required(source, "PORT", issues);
  const mongodbUri = required(source, "MONGODB_URI", issues);
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

  if (issues.length > 0) {
    throw new EnvironmentValidationError(issues);
  }

  return {
    nodeEnv: rawNodeEnv as NodeEnvironment,
    port,
    mongodbUri: mongodbUri!,
    logLevel: rawLogLevel as LogLevel
  };
}
