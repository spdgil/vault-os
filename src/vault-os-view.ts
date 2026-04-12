import { ItemView, WorkspaceLeaf } from "obsidian";
import { VIEW_TYPE_VAULT_OS } from "./constants";
import PlaceholderView from "./components/PlaceholderView.svelte";

export class VaultOSView extends ItemView {
  private component: PlaceholderView | null = null;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_VAULT_OS;
  }

  getDisplayText(): string {
    return "Vault OS";
  }

  getIcon(): string {
    return "layout-dashboard";
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1];
    container.empty();

    this.component = new PlaceholderView({
      target: container,
    });
  }

  async onClose(): Promise<void> {
    if (this.component) {
      this.component.$destroy();
      this.component = null;
    }
  }
}
