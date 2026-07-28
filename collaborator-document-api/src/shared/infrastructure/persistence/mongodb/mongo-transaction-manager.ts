import {Injectable} from "@tsed/di";
import {MongooseService} from "@tsed/mongoose";
import type {ClientSession} from "mongoose";

@Injectable()
export class MongoTransactionManager {
  constructor(private readonly mongooseService: MongooseService) {}

  async execute<T>(work: (session: ClientSession) => Promise<T>): Promise<T> {
    const connection = this.mongooseService.get();
    if (!connection) {
      throw new Error("MongoDB connection is not available");
    }

    const session = await connection.startSession();
    try {
      let result: T | undefined;
      await session.withTransaction(async () => {
        result = await work(session);
      });
      return result as T;
    } finally {
      await session.endSession();
    }
  }
}
