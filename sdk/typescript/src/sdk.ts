import type { ArkafundSdkConfig } from "./core/config.js";
import {
  ArkafundSdkExtension,
  ExtensionRegistry,
} from "./core/extensions.js";
import { OracleGuardModule } from "./modules/oracleGuard.js";
import { RegistryModule } from "./modules/registry.js";
import { VaultModule } from "./modules/vault.js";

export const SDK_VERSION = "0.1.0";

export class ArkafundSdk {
  readonly extensions = new ExtensionRegistry();

  constructor(readonly config: ArkafundSdkConfig) {}

  registry(contractId: string): RegistryModule {
    return new RegistryModule(this.config, contractId);
  }

  oracleGuard(contractId: string): OracleGuardModule {
    return new OracleGuardModule(this.config, contractId);
  }

  vault(contractId: string): VaultModule {
    return new VaultModule(this.config, contractId);
  }

  use<T>(extension: ArkafundSdkExtension<T>): T {
    return this.extensions.use(this, extension);
  }

  getExtension<T>(id: string): T | undefined {
    return this.extensions.get<T>(id);
  }
}
