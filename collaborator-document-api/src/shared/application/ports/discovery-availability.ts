/**
 * Porta para verificar se o módulo de discovery está
 * disponível (geralmente depende do MongoDB).
 */
export interface DiscoveryAvailability {
  isAvailable(): boolean | Promise<boolean>;
}
