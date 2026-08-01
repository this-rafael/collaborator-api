import {err, ok, type Result} from "neverthrow";

import type {Clock} from "../../../../shared/application/ports/clock.js";
import type {IdGenerator} from "../../../../shared/application/ports/id-generator.js";
import {DocumentType} from "../../domain/entities/document-type.js";
import {
  documentTypeApplicationFailure,
  type DocumentTypeFailure
} from "../../domain/errors/document-type.failure.js";
import type {CreateDocumentTypeInput} from "../contracts/document-type-input.js";
import {documentTypeToOutput, type DocumentTypeOutput} from "../contracts/document-type-output.js";
import type {DocumentTypeRepository} from "../../domain/repositories/document-type.repository.js";

/** Caso de uso para criação de um tipo de documento. */
export class CreateDocumentTypeUseCase {
  /**
   * @param repository - Repositório usado para persistir o novo tipo.
   * @param clock - Relógio que fornece o instante corrente.
   * @param ids - Gerador de identificadores únicos.
   */
  constructor(
    private readonly repository: Pick<DocumentTypeRepository, "create">,
    private readonly clock: Clock,
    private readonly ids: IdGenerator
  ) {}

  /**
   * Cria e persiste um novo tipo de documento.
   *
   * @param input - Dados primitivos de criação (nome, código e descrição).
   * @returns Result com `DocumentTypeOutput` em sucesso; em falha,
   * `DocumentTypeFailure` com códigos `VALIDATION_ERROR` (dados inválidos),
   * `DUPLICATE_ACTIVE_DOCUMENT_TYPE_CODE` (código já usado entre ativos),
   * `INTERNAL_SERVER_ERROR` (falha ao obter id/relógio) ou `SERVICE_UNAVAILABLE`.
   */
  async execute(
    input: CreateDocumentTypeInput
  ): Promise<Result<DocumentTypeOutput, DocumentTypeFailure>> {
    let id: string;
    let now: Date;
    try {
      id = this.ids.next();
      now = this.clock.now();
    } catch {
      return err(
        documentTypeApplicationFailure(
          "INTERNAL_SERVER_ERROR",
          "Document type creation dependencies failed."
        )
      );
    }

    const documentType = DocumentType.create({...input, id}, now);
    if (documentType.isErr()) return err(documentType.error);

    const created = await this.repository.create(documentType.value);
    if (created.isErr()) return err(created.error);
    return ok(documentTypeToOutput(created.value));
  }
}
