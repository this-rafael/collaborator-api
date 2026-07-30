/**
 * Porta para verificar se a aplicação está pronta para
 * receber tráfego (readiness probe).
 */
export interface ReadinessCheck {
  isReady(): boolean | Promise<boolean>;
}
