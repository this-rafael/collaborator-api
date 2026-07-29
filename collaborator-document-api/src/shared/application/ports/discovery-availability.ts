export interface DiscoveryAvailability {
  isAvailable(): boolean | Promise<boolean>;
}
