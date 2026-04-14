import { ItemView } from "obsidian";
import type { WorkspaceLeaf } from "obsidian";
import { VIEW_TYPE_KANBAN, ICON_KANBAN, VAULT_PATHS } from "./constants";
import KanbanBoard from "./components/KanbanBoard.svelte";
import type { VaultParser } from "./vault-parser";
import type { FrontmatterWriter } from "./frontmatter-writer";

export class KanbanViewLeaf extends ItemView {
  private component: KanbanBoard | null = null;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    private vaultParser: VaultParser,
    private frontmatterWriter: FrontmatterWriter,
  ) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_KANBAN;
  }

  getDisplayText(): string {
    return "Task Board";
  }

  getIcon(): string {
    return ICON_KANBAN;
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1];
    container.empty();

    this.component = new KanbanBoard({
      target: container,
      props: {
        app: this.app,
        vaultParser: this.vaultParser,
        frontmatterWriter: this.frontmatterWriter,
      },
    });

    const refreshIfRelevant = (path: string) => {
      if (path.startsWith(VAULT_PATHS.tasks + "/")) this.scheduleRefresh();
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
