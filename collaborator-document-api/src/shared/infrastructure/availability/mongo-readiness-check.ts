import {Injectable} from "@tsed/di";
import {MongooseService} from "@tsed/mongoose";

import type {ReadinessCheck} from "../../application/ports/readiness-check.js";

/**
 * Adaptador de infraestrutura que verifica o readiness da
 * aplicação testando a conexão MongoDB via `admin().ping()`.
 *
 * Usa a conexão do Ts.ED (`MongooseService`), não o default
 * ocioso `mongoose.connection`.
 */
@Injectable()
export class MongoReadinessCheck implements ReadinessCheck {
  /**
   * @param mongooseService - Serviço do Ts.ED que fornece a conexão Mongoose
   *   ativa para o ping de readiness.
   */
  constructor(private readonly mongooseService: MongooseService) {}

  /**
   * Verifica o readiness pingando o MongoDB (`admin().ping()`).
   *
   * @returns `true` quando a conexão está aberta e o ping responde; `false` em
   *   qualquer falha. Em ambiente de teste, respeita `HEALTH_TEST_READINESS`
   *   (`available`/`unavailable`) para forçar o resultado.
   * @remarks Qualquer exceção do driver é capturada e convertida em `false`,
   *   nunca propagada.
   */
  async isReady(): Promise<boolean> {
    if (process.env.NODE_ENV === "test") {
      const forced = process.env.HEALTH_TEST_READINESS;
      if (forced === "available") {
        return true;
      }
      if (forced === "unavailable") {
        return false;
      }
    }

    try {
      const connection = this.mongooseService.get();
      if (connection?.readyState !== 1) {
        return false;
      }
      await connection.db?.admin()?.ping();
      return true;
    } catch {
      return false;
    }
  }
}
