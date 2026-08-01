import {Injectable} from "@tsed/di";
import {MongooseService} from "@tsed/mongoose";
import type {IndexDescription, IndexDescriptionInfo} from "mongodb";

/**
 * Serviço gerenciador de índices MongoDB.
 *
 * Oferece métodos para criar e listar índices em coleções
 * específicas. Utiliza o MongooseService do Ts.ED para
 * obter a conexão ativa.
 */
@Injectable()
export class MongoIndexManager {
  /**
   * @param mongooseService - Serviço do Ts.ED que fornece a conexão Mongoose
   *   ativa.
   */
  constructor(private readonly mongooseService: MongooseService) {}

  /**
   * Cria (idempotentemente) os índices informados em uma coleção.
   *
   * @param collection - Nome da coleção alvo.
   * @param indexes - Descrições dos índices a garantir.
   * @returns Lista com os nomes dos índices criados/garantidos.
   * @throws Error quando a conexão ou o banco MongoDB não estão disponíveis.
   */
  async ensure(collection: string, indexes: readonly IndexDescription[]): Promise<string[]> {
    const db = this.database();
    return db.collection(collection).createIndexes([...indexes]);
  }

  /**
   * Lista os índices atualmente existentes em uma coleção.
   *
   * @param collection - Nome da coleção alvo.
   * @returns Informações dos índices presentes na coleção.
   * @throws Error quando a conexão ou o banco MongoDB não estão disponíveis.
   */
  async list(collection: string): Promise<IndexDescriptionInfo[]> {
    return this.database().collection(collection).listIndexes().toArray();
  }

  private connection() {
    const connection = this.mongooseService.get();
    if (!connection) {
      throw new Error("MongoDB connection is not available");
    }
    return connection;
  }

  private database() {
    const db = this.connection().db;
    if (!db) {
      throw new Error("MongoDB database is not available");
    }
    return db;
  }
}
