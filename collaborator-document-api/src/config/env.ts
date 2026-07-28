export type AppEnv = {
  nodeEnv: string;
  port: number;
  mongodbUri: string;
  logLevel: string;
};

function readNumber(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid numeric environment value: ${value}`);
  }

  return parsed;
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  return {
    nodeEnv: source.NODE_ENV ?? "development",
    port: readNumber(source.PORT, 3000),
    mongodbUri:
      source.MONGODB_URI ??
      "mongodb://localhost:27017/collaborator_documents?replicaSet=rs0",
    logLevel: source.LOG_LEVEL ?? "info"
  };
}
