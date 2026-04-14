import { ItemView } from "obsidian";
import type { WorkspaceLeaf } from "obsidian";
import { VIEW_TYPE_DAY, ICON_DAY, VAULT_PATHS } from "./constants";
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
    return ICON_DAY;
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

    const refreshIfRelevant = (path: string) => {
      if (this.isRelevantPath(path)) this.scheduleRefresh();
    };

    this.registerEvent(
      this.app.vault.on("modify", (file) => refreshIfRelevant(file.path)),
    );
    this.registerEvent(
      this.app.vault.on("create", (file) => refreshIfRelevant(file.path)),
    );
    this.registerEvent(
      this.app.vault.on("delete", (file) => refreshIfRelevant(file.path)),
    );
  }

  private isRelevantPath(path: string): boolean {
    return (
      path.startsWith(VAULT_PATHS.tasks + "/") ||
      path.startsWith(VAULT_PATHS.dailyNotes + "/") ||
      path.startsWith(VAULT_PATHS.insights + "/") ||
      path.startsWith("areas/") ||
      path.startsWith("projects/") ||
      path === VAULT_PATHS.lifeSystem
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
