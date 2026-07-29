import {describe, expect, it} from "vitest";

import {ApplicationFailure} from "../../src/shared/application/application-failure.js";
import {DomainFailure} from "../../src/shared/domain/domain-failure.js";
import {failure, success} from "../../src/shared/result.js";
import {FixedClock} from "../helpers/clock.js";
import {simulatedFailure} from "../helpers/failures.js";
import {fixture, sequenceFixture} from "../helpers/fixtures.js";

describe("Shared foundation helpers", () => {
  it("represents domain and application failures without throwing", () => {
    const domain = new DomainFailure("COL_INVALID_CPF", "CPF inválido");
    const application = new ApplicationFailure("PERSISTENCE_UNAVAILABLE", "Banco indisponível");

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
  });

  it("exposes Result helpers based on neverthrow", () => {
    expect(success({id: "collaborator-1"})).toMatchObject({value: {id: "collaborator-1"}});
    expect(failure(new DomainFailure("COL_INVALID_NAME", "Nome inválido"))).toMatchObject({
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
});
