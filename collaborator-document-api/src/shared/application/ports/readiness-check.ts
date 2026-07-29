export interface ReadinessCheck {
  isReady(): boolean | Promise<boolean>;
}
