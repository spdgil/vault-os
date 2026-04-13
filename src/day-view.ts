import { ItemView } from "obsidian";
import type { WorkspaceLeaf } from "obsidian";
import { VIEW_TYPE_DAY } from "./constants";
import DayView from "./components/DayView.svelte";
import type { VaultParser } from "./vault-parser";
import type { FrontmatterWriter } from "./frontmatter-writer";

export class DayViewLeaf extends ItemView {
  private component: DayView | null = null;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    private vaultParser: VaultParser,
    private frontmatterWriter: FrontmatterWriter,
  ) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_DAY;
  }

  getDisplayText(): string {
    return "Day View";
  }

  getIcon(): string {
    return "calendar-days";
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1];
    container.empty();

    this.component = new DayView({
      target: container,
      props: {
        app: this.app,
        vaultParser: this.vaultParser,
        frontmatterWriter: this.frontmatterWriter,
      },
    });

    this.registerEvent(
      this.app.vault.on("modify", () => this.scheduleRefresh()),
    );
    this.registerEvent(
      this.app.vault.on("create", () => this.scheduleRefresh()),
    );
    this.registerEvent(
      this.app.vault.on("delete", () => this.scheduleRefresh()),
    );
  }

  async onClose(): Promise<void> {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    this.component?.$destroy();
    this.component = null;
  }

  private scheduleRefresh(): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(() => {
      this.component?.refresh();
    }, 300);
  }
}
