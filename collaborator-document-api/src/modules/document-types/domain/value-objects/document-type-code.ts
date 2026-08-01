import {err, ok, type Result} from "neverthrow";

import {
  documentTypeDomainFailure,
  type DocumentTypeDomainFailure
} from "../errors/document-type.failure.js";

const CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,63}$/;

/**
 * Objeto de valor que representa o código canônico e estável de um tipo de
 * documento.
 *
 * @remarks
 * O código deve casar com o padrão `^[A-Z][A-Z0-9_]{1,63}$` (letra maiúscula
 * inicial seguida de maiúsculas, dígitos ou underscore, totalizando de 2 a 64
 * caracteres) e é único entre os tipos ativos.
 */
export class DocumentTypeCode {
  /**
   * Uso interno; instâncias válidas são obtidas pelo método estático `create`.
   *
   * @param value - Valor textual já validado do código.
   */
  private constructor(readonly value: string) {}

  /**
   * Valida e cria um código de tipo de documento a partir de uma entrada bruta.
   *
   * @param input - Valor candidato a código; espera-se uma `string`.
   * @returns Result com o `DocumentTypeCode` em sucesso; em falha,
   * `DocumentTypeDomainFailure` com código `VALIDATION_ERROR` quando a entrada
   * não é string ou não atende ao padrão exigido.
   */
  static create(input: unknown): Result<DocumentTypeCode, DocumentTypeDomainFailure> {
    if (typeof input !== "string") {
      return err(documentTypeDomainFailure("VALIDATION_ERROR", "code must be a string"));
    }
    if (!CODE_PATTERN.test(input)) {
      return err(
        documentTypeDomainFailure("VALIDATION_ERROR", "code must match ^[A-Z][A-Z0-9_]{1,63}$")
      );
    }
    return ok(new DocumentTypeCode(input));
  }
}
