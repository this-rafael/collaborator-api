import {Injectable} from "@tsed/di";
import {Types} from "mongoose";

import type {IdGenerator} from "../../../application/ports/id-generator.js";

/** Gera ObjectIds MongoDB em formato hexadecimal antes da persistência. */
@Injectable()
export class MongoObjectIdGenerator implements IdGenerator {
  /**
   * Gera um novo ObjectId do MongoDB em formato hexadecimal.
   *
   * @returns Identificador hexadecimal de 24 caracteres pronto para uso como
   *   `_id` antes da persistência.
   */
  next(): string {
    return new Types.ObjectId().toHexString();
  }
}
