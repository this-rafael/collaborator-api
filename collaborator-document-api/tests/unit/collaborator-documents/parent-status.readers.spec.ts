import {err, ok} from "neverthrow";
import {describe, expect, it, vi} from "vitest";

import {
  CollaboratorStatusReaderAdapter,
  DocumentTypeStatusReaderAdapter
} from "../../../src/modules/collaborator-documents/infrastructure/adapters/parent-status.readers.js";

const collaboratorId = "66a64ab05bd7213b90d9b001";
const documentTypeId = "66a64ab05bd7213b90d9b010";

describe("Parent status reader adapters", () => {
  it("maps collaborator lookup outcomes including catch and generic failures", async () => {
    const successInjector = {
      get: () => ({
        application: {
          get: {execute: vi.fn().mockResolvedValue(ok({deletedAt: null}))}
        }
      })
    };
    const deletedInjector = {
      get: () => ({
        application: {
          get: {
            execute: vi
              .fn()
              .mockResolvedValue(ok({deletedAt: new Date("2026-07-30T12:00:00.000Z")}))
          }
        }
      })
    };
    const notFoundInjector = {
      get: () => ({
        application: {
          get: {
            execute: vi.fn().mockResolvedValue(err({code: "COLLABORATOR_NOT_FOUND"}))
          }
        }
      })
    };
    const unavailableInjector = {
      get: () => ({
        application: {
          get: {
            execute: vi.fn().mockResolvedValue(err({code: "SERVICE_UNAVAILABLE"}))
          }
        }
      })
    };
    const genericInjector = {
      get: () => ({
        application: {
          get: {
            execute: vi.fn().mockResolvedValue(err({code: "VALIDATION_ERROR"}))
          }
        }
      })
    };
    const throwingInjector = {
      get: () => {
        throw new Error("runtime missing");
      }
    };

    await expect(
      new CollaboratorStatusReaderAdapter(successInjector as never).read(collaboratorId)
    ).resolves.toMatchObject({value: "ACTIVE"});
    await expect(
      new CollaboratorStatusReaderAdapter(deletedInjector as never).read(collaboratorId)
    ).resolves.toMatchObject({error: {code: "COLLABORATOR_DELETED"}});
    await expect(
      new CollaboratorStatusReaderAdapter(notFoundInjector as never).read(collaboratorId)
    ).resolves.toMatchObject({error: {code: "COLLABORATOR_NOT_FOUND"}});
    await expect(
      new CollaboratorStatusReaderAdapter(unavailableInjector as never).read(collaboratorId)
    ).resolves.toMatchObject({error: {code: "SERVICE_UNAVAILABLE"}});
    await expect(
      new CollaboratorStatusReaderAdapter(genericInjector as never).read(collaboratorId)
    ).resolves.toMatchObject({error: {code: "INTERNAL_SERVER_ERROR"}});
    await expect(
      new CollaboratorStatusReaderAdapter(throwingInjector as never).read(collaboratorId)
    ).resolves.toMatchObject({error: {code: "SERVICE_UNAVAILABLE"}});
  });

  it("maps document type lookup outcomes including catch and generic failures", async () => {
    const successInjector = {
      get: () => ({
        application: {
          get: {execute: vi.fn().mockResolvedValue(ok({deletedAt: null}))}
        }
      })
    };
    const deletedInjector = {
      get: () => ({
        application: {
          get: {
            execute: vi
              .fn()
              .mockResolvedValue(ok({deletedAt: new Date("2026-07-30T12:00:00.000Z")}))
          }
        }
      })
    };
    const notFoundInjector = {
      get: () => ({
        application: {
          get: {
            execute: vi.fn().mockResolvedValue(err({code: "DOCUMENT_TYPE_NOT_FOUND"}))
          }
        }
      })
    };
    const unavailableInjector = {
      get: () => ({
        application: {
          get: {
            execute: vi.fn().mockResolvedValue(err({code: "SERVICE_UNAVAILABLE"}))
          }
        }
      })
    };
    const genericInjector = {
      get: () => ({
        application: {
          get: {
            execute: vi.fn().mockResolvedValue(err({code: "VALIDATION_ERROR"}))
          }
        }
      })
    };
    const throwingInjector = {
      get: () => {
        throw new Error("runtime missing");
      }
    };

    await expect(
      new DocumentTypeStatusReaderAdapter(successInjector as never).read(documentTypeId)
    ).resolves.toMatchObject({value: "ACTIVE"});
    await expect(
      new DocumentTypeStatusReaderAdapter(deletedInjector as never).read(documentTypeId)
    ).resolves.toMatchObject({error: {code: "DOCUMENT_TYPE_DELETED"}});
    await expect(
      new DocumentTypeStatusReaderAdapter(notFoundInjector as never).read(documentTypeId)
    ).resolves.toMatchObject({error: {code: "DOCUMENT_TYPE_NOT_FOUND"}});
    await expect(
      new DocumentTypeStatusReaderAdapter(unavailableInjector as never).read(documentTypeId)
    ).resolves.toMatchObject({error: {code: "SERVICE_UNAVAILABLE"}});
    await expect(
      new DocumentTypeStatusReaderAdapter(genericInjector as never).read(documentTypeId)
    ).resolves.toMatchObject({error: {code: "INTERNAL_SERVER_ERROR"}});
    await expect(
      new DocumentTypeStatusReaderAdapter(throwingInjector as never).read(documentTypeId)
    ).resolves.toMatchObject({error: {code: "SERVICE_UNAVAILABLE"}});
  });
});
