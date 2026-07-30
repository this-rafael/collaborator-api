import type {Clock} from "../../src/shared/application/ports/clock.js";

export type {Clock};

export class FixedClock implements Clock {
  constructor(private readonly instant: Date) {}

  now(): Date {
    return new Date(this.instant);
  }
}
