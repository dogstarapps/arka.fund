import type { ArkafundSdkConfig } from "./core/config.js";
import {
  ArkafundSdkExtension,
  ExtensionRegistry,
} from "./core/extensions.js";
import { OracleGuardModule } from "./modules/oracleGuard.js";
import { FactoryModule } from "./modules/factory.js";
import { RegistryModule } from "./modules/registry.js";
import { RouterModule } from "./modules/router.js";
import { VenueRegistryModule } from "./modules/venueRegistry.js";
import { VaultModule } from "./modules/vault.js";

export const SDK_VERSION = "0.2.2";

export class ArkafundSdk {
  readonly extensions = new ExtensionRegistry();

  constructor(readonly config: ArkafundSdkConfig) {}

  registry(contractId: string): RegistryModule {
    return new RegistryModule(this.config, contractId);
  }

  factory(contractId: string): FactoryModule {
    return new FactoryModule(this.config, contractId);
  }

  oracleGuard(contractId: string): OracleGuardModule {
    return new OracleGuardModule(this.config, contractId);
  }

  vault(contractId: string): VaultModule {
    return new VaultModule(this.config, contractId);
  }

  router(contractId: string): RouterModule {
    return new RouterModule(this.config, contractId);
  }

  venueRegistry(contractId: string): VenueRegistryModule {
    return new VenueRegistryModule(this.config, contractId);
  }

  use<T>(extension: ArkafundSdkExtension<T>): T {
    return this.extensions.use(this, extension);
  }

  getExtension<T>(id: string): T | undefined {
    return this.extensions.get<T>(id);
  }
}
