import {beforeEach, describe, expect, it, vi} from "vitest";

import {Collaborator} from "../../src/modules/collaborators/domain/collaborator.js";

const getCollaboratorModel = vi.hoisted(() => vi.fn());

vi.mock("../../src/modules/collaborators/infrastructure/mongoose/collaborator.schema.js", () => ({
  getCollaboratorModel
}));

const validCollaborator = () =>
  Collaborator.create({
    name: "Ana Silva",
    cpf: "12345678909",
    email: "ana@example.com"
  })._unsafeUnwrap();

const validRow = {
  _id: {toString: () => "66a64ab05bd7213b90d9b001"},
  name: "Ana Silva",
  cpf: "12345678909",
  email: "ana@example.com",
  createdAt: new Date("2026-07-29T12:00:00.000Z"),
  updatedAt: new Date("2026-07-29T12:00:00.000Z"),
  deletedAt: null
};

describe("MongoCollaboratorRepository error paths", () => {
  beforeEach(() => {
    getCollaboratorModel.mockReset();
  });

  it("maps create catch without keyPattern to SERVICE_UNAVAILABLE", async () => {
    getCollaboratorModel.mockReturnValue({
      create: async () => {
        throw new Error("network down");
      }
    });
    const {MongoCollaboratorRepository} =
      await import("../../src/modules/collaborators/infrastructure/repositories/mongo-collaborator.repository.js");

    const result = await new MongoCollaboratorRepository().create(validCollaborator());
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error).toBe("SERVICE_UNAVAILABLE");
  });

  it("maps duplicate email keyPattern on create", async () => {
    getCollaboratorModel.mockReturnValue({
      create: async () => {
        throw {keyPattern: {email: 1}};
      }
    });
    const {MongoCollaboratorRepository} =
      await import("../../src/modules/collaborators/infrastructure/repositories/mongo-collaborator.repository.js");

    const result = await new MongoCollaboratorRepository().create(validCollaborator());
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error).toBe("DUPLICATE_ACTIVE_EMAIL");
  });

  it("maps unknown keyPattern on create to SERVICE_UNAVAILABLE", async () => {
    getCollaboratorModel.mockReturnValue({
      create: async () => {
        throw {keyPattern: {other: 1}};
      }
    });
    const {MongoCollaboratorRepository} =
      await import("../../src/modules/collaborators/infrastructure/repositories/mongo-collaborator.repository.js");

    const result = await new MongoCollaboratorRepository().create(validCollaborator());
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error).toBe("SERVICE_UNAVAILABLE");
  });

  it("rejects an invalid afterId without querying", async () => {
    getCollaboratorModel.mockReturnValue({
      find: () => {
        throw new Error("should not query");
      }
    });
    const {MongoCollaboratorRepository} =
      await import("../../src/modules/collaborators/infrastructure/repositories/mongo-collaborator.repository.js");

    const result = await new MongoCollaboratorRepository().listActive({
      filters: {},
      afterId: "not-a-valid-object-id",
      limit: 10
    });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error).toBe("SERVICE_UNAVAILABLE");
  });

  it("maps a corrupt persistence row to SERVICE_UNAVAILABLE", async () => {
    getCollaboratorModel.mockReturnValue({
      find: () => ({
        sort: () => ({
          limit: () => ({
            lean: async () => [{...validRow, email: "not-an-email"}]
          })
        })
      })
    });
    const {MongoCollaboratorRepository} =
      await import("../../src/modules/collaborators/infrastructure/repositories/mongo-collaborator.repository.js");

    const result = await new MongoCollaboratorRepository().listActive({
      filters: {},
      limit: 10
    });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error).toBe("SERVICE_UNAVAILABLE");
  });

  it("maps findById catch to SERVICE_UNAVAILABLE", async () => {
    getCollaboratorModel.mockReturnValue({
      findById: () => ({
        lean: async () => {
          throw new Error("timeout");
        }
      })
    });
    const {MongoCollaboratorRepository} =
      await import("../../src/modules/collaborators/infrastructure/repositories/mongo-collaborator.repository.js");

    const result = await new MongoCollaboratorRepository().findById("66a64ab05bd7213b90d9b001");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error).toBe("SERVICE_UNAVAILABLE");
  });

  it("maps listActive query failures to SERVICE_UNAVAILABLE", async () => {
    getCollaboratorModel.mockReturnValue({
      find: () => ({
        sort: () => ({
          limit: () => ({
            lean: async () => {
              throw new Error("list failed");
            }
          })
        })
      })
    });
    const {MongoCollaboratorRepository} =
      await import("../../src/modules/collaborators/infrastructure/repositories/mongo-collaborator.repository.js");

    const result = await new MongoCollaboratorRepository().listActive({
      filters: {},
      limit: 10
    });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error).toBe("SERVICE_UNAVAILABLE");
  });

  it("maps updateActive catch and deleted-row status", async () => {
    getCollaboratorModel.mockReturnValue({
      findOneAndUpdate: () => ({
        lean: async () => {
          throw new Error("update failed");
        }
      })
    });
    const {MongoCollaboratorRepository} =
      await import("../../src/modules/collaborators/infrastructure/repositories/mongo-collaborator.repository.js");

    const result = await new MongoCollaboratorRepository().updateActive(
      "66a64ab05bd7213b90d9b001",
      {email: "new@example.com"}
    );
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error).toBe("SERVICE_UNAVAILABLE");
  });

  it("maps rows that expose id without _id", async () => {
    getCollaboratorModel.mockReturnValue({
      find: () => ({
        sort: () => ({
          limit: () => ({
            lean: async () => [{...validRow, _id: undefined, id: "66a64ab05bd7213b90d9b002"}]
          })
        })
      })
    });
    const {MongoCollaboratorRepository} =
      await import("../../src/modules/collaborators/infrastructure/repositories/mongo-collaborator.repository.js");

    const result = await new MongoCollaboratorRepository().listActive({
      filters: {},
      limit: 10
    });
    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value.items[0]?.props.id).toBe("66a64ab05bd7213b90d9b002");
  });

  it("maps update of a soft-deleted collaborator", async () => {
    getCollaboratorModel.mockReturnValue({
      findOneAndUpdate: () => ({
        lean: async () => null
      }),
      findById: () => ({
        select: () => ({
          lean: async () => ({deletedAt: new Date("2026-07-29T12:00:00.000Z")})
        })
      })
    });
    const {MongoCollaboratorRepository} =
      await import("../../src/modules/collaborators/infrastructure/repositories/mongo-collaborator.repository.js");

    const result = await new MongoCollaboratorRepository().updateActive(
      "66a64ab05bd7213b90d9b001",
      {name: "Ana"}
    );
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error).toBe("COLLABORATOR_DELETED");
  });
});
