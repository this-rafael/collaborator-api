/**
 * Porta para verificar se a aplicação está pronta para
 * receber tráfego (readiness probe).
 */
export interface ReadinessCheck {
  /**
   * Avalia se a aplicação está pronta para receber tráfego.
   *
   * @returns `true` quando as dependências críticas estão saudáveis; pode
   *   resolver de forma síncrona ou assíncrona.
   */
  isReady(): boolean | Promise<boolean>;
}
