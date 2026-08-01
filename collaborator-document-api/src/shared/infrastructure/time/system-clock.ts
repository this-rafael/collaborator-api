import {Injectable} from "@tsed/di";

import type {Clock} from "../../application/ports/clock.js";

/** Relógio de produção baseado no tempo do processo. */
@Injectable()
export class SystemClock implements Clock {
  /**
   * Obtém o instante atual do processo.
   *
   * @returns A data/hora corrente (`new Date()`).
   */
  now(): Date {
    return new Date();
  }
}
