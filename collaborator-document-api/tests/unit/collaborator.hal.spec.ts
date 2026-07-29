import {describe, expect, it} from "vitest";

import {Collaborator} from "../../src/modules/collaborators/domain/collaborator.js";
import {collaboratorHal} from "../../src/modules/collaborators/presentation/presenters/collaborator.hal.js";

describe("collaboratorHal", () => {
  it("falls back to a zero ObjectId when the collaborator has no id", () => {
    const collaborator = Collaborator.create({
      name: "Ana Silva",
      cpf: "12345678909",
      email: "ana@example.com"
    })._unsafeUnwrap();

    const presented = collaboratorHal(collaborator);

    expect(presented.id).toBe("000000000000000000000000");
    expect(presented._links.self.href).toBe("/api/v1/collaborators/000000000000000000000000");
  });
});
