/**
 * Caso de uso de criação (e revinculação) de vínculos documentais.
 */
import {err, ok, type Result} from "neverthrow";

import type {Clock} from "../../../../shared/application/ports/clock.js";
import type {IdGenerator} from "../../../../shared/application/ports/id-generator.js";
import type {
  TransactionFailure,
  TransactionManager
} from "../../../../shared/application/ports/transaction-manager.js";
import {CollaboratorDocument} from "../../domain/aggregates/collaborator-document.js";
import {
  collaboratorDocumentApplicationFailure,
  type CollaboratorDocumentFailure
} from "../../domain/errors/collaborator-document.failure.js";
import type {CollaboratorDocumentOutput} from "../contracts/collaborator-document-output.js";
import type {CollaboratorDocumentRepository} from "../ports/collaborator-document-repository.port.js";
import type {
  CollaboratorStatusReader,
  DocumentTypeStatusReader
} from "../ports/parent-status.readers.js";

/** Entrada de criação de vínculo (colaborador e tipo de documento). */
export type CreateCollaboratorDocumentInput = Readonly<{
  collaboratorId: string;
  documentTypeId: string;
}>;

/**
 * Caso de uso de criação / revinculação de vínculo documental.
 *
 * @remarks
 * Valida que colaborador e tipo de documento estão ativos, então cria um novo
 * ciclo PENDING. A revinculação após encerramento de um ciclo anterior gera um
 * NOVO documento lógico. A unicidade do vínculo ativo é garantida por índice no
 * MongoDB, refletida na falha ACTIVE_LINK_ALREADY_EXISTS.
 */
export class CreateCollaboratorDocumentUseCase {
  /**
   * @param repository - Porta de persistência (apenas a operação `create`).
   * @param collaborators - Leitor de status do colaborador.
   * @param documentTypes - Leitor de status do tipo de documento.
   * @param clock - Relógio para obter o instante corrente.
   * @param ids - Gerador de identificadores para o novo vínculo.
   */
  constructor(
    private readonly repository: Pick<CollaboratorDocumentRepository, "create">,
    private readonly collaborators: CollaboratorStatusReader,
    private readonly documentTypes: DocumentTypeStatusReader,
    private readonly transactions: TransactionManager,
    private readonly clock: Clock,
    private readonly ids: IdGenerator
  ) {}

  /**
   * Executa a criação do vínculo documental.
   *
   * @param input - Identificadores do colaborador e do tipo de documento.
   * @returns Result com a saída do vínculo criado em sucesso; em falha,
   * CollaboratorDocumentFailure com códigos VALIDATION_ERROR, COLLABORATOR_NOT_FOUND,
   * COLLABORATOR_DELETED, DOCUMENT_TYPE_NOT_FOUND, DOCUMENT_TYPE_DELETED,
   * ACTIVE_LINK_ALREADY_EXISTS, SERVICE_UNAVAILABLE ou INTERNAL_SERVER_ERROR.
   */
  async execute(
    input: CreateCollaboratorDocumentInput
  ): Promise<Result<CollaboratorDocumentOutput, CollaboratorDocumentFailure | TransactionFailure>> {
    return this.transactions.execute(async (context) => {
      const collaborator = await this.collaborators.reserveActive(input.collaboratorId, context);
      if (collaborator.isErr()) return err(collaborator.error);

      const documentType = await this.documentTypes.reserveActive(input.documentTypeId, context);
      if (documentType.isErr()) return err(documentType.error);

      let id: string;
      let now: Date;
      try {
        id = this.ids.next();
        now = this.clock.now();
      } catch {
        return err(
          collaboratorDocumentApplicationFailure(
            "INTERNAL_SERVER_ERROR",
            "Collaborator document creation dependencies failed."
          )
        );
      }

      const document = CollaboratorDocument.createPendingCycle(
        {id, collaboratorId: input.collaboratorId, documentTypeId: input.documentTypeId},
        now
      );
      if (document.isErr()) return err(document.error);

      const created = await this.repository.create(document.value, context);
      if (created.isErr()) return err(created.error);
      return ok(created.value);
    });
  }
}
