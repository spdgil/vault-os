import { Plugin } from "obsidian";
import type { WorkspaceLeaf } from "obsidian";
import {
  VIEW_TYPE_VAULT_OS,
  ICON_VAULT_OS,
  VIEW_TYPE_DAY,
  ICON_DAY,
  VIEW_TYPE_KANBAN,
  ICON_KANBAN,
} from "./constants";
import { VaultOSView } from "./vault-os-view";
import { DayViewLeaf } from "./day-view";
import { KanbanViewLeaf } from "./kanban-view";
import { VaultParser } from "./vault-parser";
import { FrontmatterWriter } from "./frontmatter-writer";
import { NoteCreator } from "./note-creator";

export default class VaultOSPlugin extends Plugin {
  vaultParser!: VaultParser;
  frontmatterWriter!: FrontmatterWriter;
  noteCreator!: NoteCreator;

  async onload(): Promise<void> {
    this.vaultParser = new VaultParser(this.app);
    this.vaultParser.registerEvents();

    this.frontmatterWriter = new FrontmatterWriter(this.app);
    this.noteCreator = new NoteCreator(this.app);

    // Placeholder view (kept for backward compatibility)
    this.registerView(VIEW_TYPE_VAULT_OS, (leaf: WorkspaceLeaf) => {
      return new VaultOSView(leaf);
    });

    // Day view — primary temporal view
    this.registerView(VIEW_TYPE_DAY, (leaf: WorkspaceLeaf) => {
      return new DayViewLeaf(leaf, this.vaultParser, this.frontmatterWriter);
    });

    // Kanban view — task board
    this.registerView(VIEW_TYPE_KANBAN, (leaf: WorkspaceLeaf) => {
      return new KanbanViewLeaf(leaf, this.vaultParser, this.frontmatterWriter);
    });

    // Ribbon icons
    this.addRibbonIcon(ICON_DAY, "Open Day View", () => {
      void this.activateDayView();
    });

    this.addRibbonIcon(ICON_KANBAN, "Open Task Board", () => {
      void this.activateView(VIEW_TYPE_KANBAN);
    });

    // Commands
    this.addCommand({
      id: "open-day-view",
      name: "Open Day View",
      callback: () => void this.activateDayView(),
    });

    this.addCommand({
      id: "open-kanban",
      name: "Open Task Board",
      callback: () => void this.activateView(VIEW_TYPE_KANBAN),
    });

    this.addCommand({
      id: "open-vault-os",
      name: "Open Vault OS",
      callback: () => void this.activateView(VIEW_TYPE_VAULT_OS),
    });
  }

  onunload(): void {
    this.vaultParser.destroy();
    setTimeout(() => {
      this.app.workspace.detachLeavesOfType(VIEW_TYPE_DAY);
      this.app.workspace.detachLeavesOfType(VIEW_TYPE_KANBAN);
      this.app.workspace.detachLeavesOfType(VIEW_TYPE_VAULT_OS);
    }, 0);
  }

  async activateDayView(): Promise<void> {
    await this.activateView(VIEW_TYPE_DAY);
  }

  private async activateView(viewType: string): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(viewType);
    if (existing.length > 0) {
      void this.app.workspace.revealLeaf(existing[0]);
      return;
    }

    const leaf = this.app.workspace.getRightLeaf(false);
    if (leaf) {
      await leaf.setViewState({ type: viewType, active: true });
      void this.app.workspace.revealLeaf(leaf);
    }
  }
}
