import type {DiscoveryAvailability} from "../../application/ports/discovery-availability.js";

export class MongoDiscoveryAvailability implements DiscoveryAvailability {
  async isAvailable(): Promise<boolean> {
    try {
      return true;
    } catch {
      return false;
    }
  }
}
