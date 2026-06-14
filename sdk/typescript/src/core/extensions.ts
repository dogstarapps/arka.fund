import type { ArkafundSdk } from "../sdk.js";

export interface ArkafundSdkExtension<T> {
  id: string;
  version: string;
  install(sdk: ArkafundSdk): T;
}

export class ExtensionRegistry {
  private readonly installed = new Map<string, unknown>();

  use<T>(sdk: ArkafundSdk, extension: ArkafundSdkExtension<T>): T {
    if (this.installed.has(extension.id)) {
      throw new Error(`Extension ${extension.id} is already registered`);
    }
    const module = extension.install(sdk);
    this.installed.set(extension.id, module);
    return module;
  }

  get<T>(id: string): T | undefined {
    return this.installed.get(id) as T | undefined;
  }

  has(id: string): boolean {
    return this.installed.has(id);
  }
}
