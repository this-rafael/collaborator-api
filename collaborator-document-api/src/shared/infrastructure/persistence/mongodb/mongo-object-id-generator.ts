import {Injectable} from "@tsed/di";
import {Types} from "mongoose";

import type {IdGenerator} from "../../../application/ports/id-generator.js";

/** Gera ObjectIds MongoDB em formato hexadecimal antes da persistência. */
@Injectable()
export class MongoObjectIdGenerator implements IdGenerator {
  next(): string {
    return new Types.ObjectId().toHexString();
  }
}
