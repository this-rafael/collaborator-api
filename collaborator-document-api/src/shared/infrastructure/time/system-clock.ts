import {Injectable} from "@tsed/di";

import type {Clock} from "../../application/ports/clock.js";

/** Relógio de produção baseado no tempo do processo. */
@Injectable()
export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
