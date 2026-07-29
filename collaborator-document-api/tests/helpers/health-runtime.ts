export interface ReadinessCheck {
  isReady(): boolean | Promise<boolean>;
}

export class AlwaysReady implements ReadinessCheck {
  isReady(): boolean {
    return true;
  }
}

export class NeverReady implements ReadinessCheck {
  isReady(): boolean {
    return false;
  }
}

const enrichedConnectionUri =
  "mongodb://admin:super-secret-password@db.example.com:27017/app?retryWrites=true&w=majority";
const enrichedDriverMessage =
  "MongoServerSelectionError: Server selection timed out after 30000 ms; connection to 10.0.0.5:27017 failed (node_modules/mongodb/lib/...)";
const enrichedStack =
  "Error: connect ECONNREFUSED 10.0.0.5:27017\n    at TCPConnectWrap.afterConnect (node:net:1495:16)";

export class FailingReadiness implements ReadinessCheck {
  isReady(): never {
    const error = new Error(
      `Não foi possível conectar em ${enrichedConnectionUri}: ${enrichedDriverMessage}\n${enrichedStack}`
    );
    error.name = "MongoNetworkError";
    throw error;
  }
}

export const enrichedLeakPatterns: readonly RegExp[] = [
  /mongodb:\/\//i,
  /super-secret-password/i,
  /admin@db\.example\.com/i,
  /retryWrites=true/i,
  /MongoServerSelectionError/i,
  /ECONNREFUSED/i,
  /node_modules/i,
  /\.ts:\d+/,
  /node:net:\d+/,
  /stack/i
];

export const assertNoInternalLeak = (serialized: string): void => {
  for (const pattern of enrichedLeakPatterns) {
    if (pattern.test(serialized)) {
      throw new Error(`Detected internal detail leak matching ${pattern}: ${serialized}`);
    }
  }
};
