import { Plugin, WorkspaceLeaf } from "obsidian";
import { VIEW_TYPE_VAULT_OS, ICON_VAULT_OS } from "./constants";
import { VaultOSView } from "./vault-os-view";

export default class VaultOSPlugin extends Plugin {
  async onload(): Promise<void> {
    this.registerView(VIEW_TYPE_VAULT_OS, (leaf: WorkspaceLeaf) => {
      return new VaultOSView(leaf);
    });

    this.addRibbonIcon(ICON_VAULT_OS, "Open Vault OS", () => {
      void this.activateView();
    });

    this.addCommand({
      id: "open-vault-os",
      name: "Open Vault OS",
      callback: () => void this.activateView(),
    });
  }

  onunload(): void {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_VAULT_OS);
  }

  async activateView(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_VAULT_OS);
    if (existing.length > 0) {
      void this.app.workspace.revealLeaf(existing[0]);
      return;
    }

    const leaf = this.app.workspace.getRightLeaf(false);
    if (leaf) {
      await leaf.setViewState({ type: VIEW_TYPE_VAULT_OS, active: true });
      void this.app.workspace.revealLeaf(leaf);
    }
  }
}
