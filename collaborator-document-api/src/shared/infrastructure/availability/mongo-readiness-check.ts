import mongoose from "mongoose";

import type {ReadinessCheck} from "../../application/ports/readiness-check.js";

export class MongoReadinessCheck implements ReadinessCheck {
  async isReady(): Promise<boolean> {
    if (process.env.NODE_ENV === "test") {
      const forced = process.env.HEALTH_TEST_READINESS;
      if (forced === "available") {
        return true;
      }
      if (forced === "unavailable") {
        return false;
      }
    }

    try {
      const connection = mongoose.connection;
      if (!connection || connection.readyState !== 1) {
        return false;
      }
      await connection.db?.admin()?.ping();
      return true;
    } catch {
      return false;
    }
  }
}
