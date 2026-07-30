import type {Clock} from "../../src/shared/application/ports/clock.js";

export interface RequestContextFixture {
  traceId: string;
  operationId: string;
  method: string;
  normalizedRoute: string;
  startedAt: Date;
}

export class ManualClock implements Clock {
  private current: Date;

  constructor(initial: Date) {
    this.current = new Date(initial);
  }

  now(): Date {
    return new Date(this.current);
  }

  advance(milliseconds: number): void {
    this.current = new Date(this.current.getTime() + milliseconds);
  }

  set(instant: Date): void {
    this.current = new Date(instant);
  }
}

export const fixedTraceId = "01J3Y2QHB8FV4RGY7Y1QXNT2D4";
export const alternateTraceId = "01J3Y2QHB8FV4RGY7Y1QXNT2D5";

export const buildRequestContextFixture = (
  overrides: Partial<RequestContextFixture> = {}
): RequestContextFixture => ({
  traceId: fixedTraceId,
  operationId: "discoverApi",
  method: "GET",
  normalizedRoute: "/api/v1",
  startedAt: new Date("2026-07-28T12:00:00.000Z"),
  ...overrides
});

export interface DiscoveryAvailability {
  isAvailable(): boolean | Promise<boolean>;
}

export class AlwaysAvailable implements DiscoveryAvailability {
  isAvailable(): boolean {
    return true;
  }
}

export class NeverAvailable implements DiscoveryAvailability {
  isAvailable(): boolean {
    return false;
  }
}

export class ToggleableAvailability implements DiscoveryAvailability {
  constructor(private available: boolean) {}

  isAvailable(): boolean {
    return this.available;
  }

  setAvailable(value: boolean): void {
    this.available = value;
  }
}
