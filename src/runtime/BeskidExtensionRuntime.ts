import type { ExtensionContext } from "vscode";
import { ExtensionServices } from "../core/ExtensionServices.js";

/** @deprecated Use `ExtensionServices` directly. Kept for compatibility with older activation tests. */
export class BeskidExtensionRuntime {
  private readonly services: ExtensionServices;

  constructor(context: ExtensionContext) {
    this.services = ExtensionServices.create(context);
  }

  async activate(): Promise<void> {
    await this.services.activate();
  }

  async deactivate(): Promise<void> {
    await this.services.deactivate();
  }
}
