import {describe, expect, it} from "vitest";

import {
  applicationFailure,
  isApplicationFailure
} from "../../src/shared/application/errors/application-failure.js";
import {domainFailure, isDomainFailure} from "../../src/shared/domain/errors/domain-failure.js";
import {MongoObjectIdGenerator} from "../../src/shared/infrastructure/persistence/mongodb/mongo-object-id-generator.js";
import {SystemClock} from "../../src/shared/infrastructure/time/system-clock.js";
import {failure, success} from "../../src/shared/result.js";
import {FixedClock} from "../helpers/clock.js";
import {simulatedFailure} from "../helpers/failures.js";
import {fixture, sequenceFixture} from "../helpers/fixtures.js";

describe("Shared foundation helpers", () => {
  it("represents domain and application failures without throwing", () => {
    const domain = domainFailure("COL_INVALID_CPF", "CPF inválido");
    const application = applicationFailure("PERSISTENCE_UNAVAILABLE", "Banco indisponível");

    expect(domain).toMatchObject({
      kind: "domain",
      code: "COL_INVALID_CPF",
      message: "CPF inválido"
    });
    expect(application).toMatchObject({
      kind: "application",
      code: "PERSISTENCE_UNAVAILABLE",
      message: "Banco indisponível"
    });
    expect(domain).not.toBeInstanceOf(Error);
    expect(application).not.toBeInstanceOf(Error);
    expect(isDomainFailure(domain)).toBe(true);
    expect(isApplicationFailure(application)).toBe(true);
    expect(isDomainFailure(application)).toBe(false);
    expect(isApplicationFailure(domain)).toBe(false);
    expect(isDomainFailure(null)).toBe(false);
    expect(isApplicationFailure(null)).toBe(false);
  });

  it("exposes Result helpers based on neverthrow", () => {
    expect(success({id: "collaborator-1"})).toMatchObject({value: {id: "collaborator-1"}});
    expect(failure(domainFailure("COL_INVALID_NAME", "Nome inválido"))).toMatchObject({
      error: expect.objectContaining({code: "COL_INVALID_NAME"})
    });
  });

  it("provides deterministic fixtures, clock and simulated failures", () => {
    const instant = new Date("2026-07-28T12:00:00.000Z");
    const clock = new FixedClock(instant);

    expect(fixture(() => ({name: "Ana"}))).toEqual({name: "Ana"});
    expect(sequenceFixture((index) => index + 1, 3)).toEqual([1, 2, 3]);
    expect(clock.now()).toEqual(instant);
    expect(clock.now()).not.toBe(instant);
    expect(simulatedFailure("connection reset")).toMatchObject({message: "connection reset"});
  });

  it("provides production clock and MongoDB-compatible generated ids", () => {
    const before = Date.now();
    const now = new SystemClock().now();
    const id = new MongoObjectIdGenerator().next();

    expect(now.getTime()).toBeGreaterThanOrEqual(before);
    expect(now.getTime()).toBeLessThanOrEqual(Date.now());
    expect(id).toMatch(/^[a-f0-9]{24}$/);
  });
});
