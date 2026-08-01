import type {DiscoveryAvailability} from "../../application/ports/discovery-availability.js";

/**
 * Adaptador de infraestrutura que verifica a
 * disponibilidade do MongoDB para o módulo de discovery.
 *
 * @remarks Atualmente retorna `true` sempre; a verificação
 *   real será implementada quando houver conexão com o
 *   banco.
 */
export class MongoDiscoveryAvailability implements DiscoveryAvailability {
  /**
   * Verifica se o módulo de discovery pode atender requisições.
   *
   * @returns Sempre `true` na implementação atual (verificação real pendente).
   */
  async isAvailable(): Promise<boolean> {
    return true;
  }
}
