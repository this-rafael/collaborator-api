import {injector} from "@tsed/di";
import {MongooseService} from "@tsed/mongoose";
import type {Connection} from "mongoose";

/**
 * Returns the ready Ts.ED Mongoose connection (`createConnection`),
 * not the idle default `mongoose.connection`.
 */
export function requireMongooseConnection(): Connection {
  const connection = injector().get<MongooseService>(MongooseService).get();
  if (!connection || connection.readyState !== 1) {
    throw new Error("MongoDB connection is not available");
  }
  return connection;
}
