import {Injectable} from "@tsed/di";
import {MongooseService} from "@tsed/mongoose";
import type {IndexDescription, IndexDescriptionInfo} from "mongodb";

@Injectable()
export class MongoIndexManager {
  constructor(private readonly mongooseService: MongooseService) {}

  async ensure(collection: string, indexes: readonly IndexDescription[]): Promise<string[]> {
    const db = this.database();
    return db.collection(collection).createIndexes([...indexes]);
  }

  async list(collection: string): Promise<IndexDescriptionInfo[]> {
    return this.database().collection(collection).listIndexes().toArray();
  }

  private connection() {
    const connection = this.mongooseService.get();
    if (!connection) {
      throw new Error("MongoDB connection is not available");
    }
    return connection;
  }

  private database() {
    const db = this.connection().db;
    if (!db) {
      throw new Error("MongoDB database is not available");
    }
    return db;
  }
}
