/**
 * Porta para verificar se o módulo de discovery está
 * disponível (geralmente depende do MongoDB).
 */
export interface DiscoveryAvailability {
  /**
   * Indica se o módulo de discovery pode atender requisições.
   *
   * @returns `true` quando disponível; pode resolver de forma síncrona ou
   *   assíncrona conforme o adaptador.
   */
  isAvailable(): boolean | Promise<boolean>;
}
