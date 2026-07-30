import {describe, expect, it} from "vitest";

import {collaboratorPresenter} from "../../src/modules/collaborators/presentation/http/presenters/collaborator.presenter.js";

describe("collaboratorPresenter", () => {
  it("uses the application identifier and exposes active mutation links", () => {
    const presented = collaboratorPresenter({
      id: "66a64ab05bd7213b90d9b001",
      name: "Ana Silva",
      cpf: "12345678909",
      email: "ana@example.com",
      createdAt: "2026-07-29T12:00:00.000Z",
      updatedAt: "2026-07-29T12:00:00.000Z",
      deletedAt: null
    });

    expect(presented.id).toBe("66a64ab05bd7213b90d9b001");
    expect(presented._links.self.href).toBe("/api/v1/collaborators/66a64ab05bd7213b90d9b001");
    expect(presented._links.update).toEqual({
      href: "/api/v1/collaborators/66a64ab05bd7213b90d9b001",
      method: "PATCH"
    });
  });
});
