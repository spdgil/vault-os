<script lang="ts">
  import { onMount } from "svelte";
  import type { App, TFile } from "obsidian";
  import type { VaultParser, ParsedNote } from "../vault-parser";
  import type { FrontmatterWriter } from "../frontmatter-writer";
  import { todayString, isOverdue, isDueOn, addDays } from "../date-utils";
  import KanbanColumn from "./KanbanColumn.svelte";

  export let app: App;
  export let vaultParser: VaultParser;
  export let frontmatterWriter: FrontmatterWriter;

  // --- Types ---

  interface CardData {
    filePath: string;
    title: string;
    due: string | null;
    priority: string;
    project: string | null;
    waitingOn: string | null;
    overdue: boolean;
  }

  interface Column {
    id: string;
    title: string;
    cards: CardData[];
  }

  const PRIORITY_WEIGHT: Record<string, number> = {
    urgent: 0,
    high: 1,
    normal: 2,
    low: 3,
  };

  // --- State ---

  let today = todayString();
  let loading = true;
  let columns: Column[] = [];

  // Drag state — managed here instead of via dataTransfer
  // so we avoid Electron/Obsidian dataTransfer quirks
  let draggedFilePath: string | null = null;

  // --- Lifecycle ---

  export function refresh(): void {
    today = todayString();
    void loadData(false);
  }

  onMount(() => {
    void loadData(true);
  });

  // --- Data loading ---

  async function loadData(showLoading: boolean): Promise<void> {
    if (showLoading) loading = true;

    try {
      const allTasks = await vaultParser.query({
        type: "task",
        folder: "tasks",
      });

      const weekFromNow = addDays(today, 7);
      const twoWeeksAgo = addDays(today, -14);

      const backlog: CardData[] = [];
      const todayCol: CardData[] = [];
      const soon: CardData[] = [];
      const someday: CardData[] = [];
      const done: CardData[] = [];

      for (const note of allTasks) {
        const status = String(note.frontmatter.status || "");
        if (status === "cancelled" || status === "deferred") continue;

        const card = noteToCard(note);

        if (status === "done" || status === "completed") {
          const dateForFilter = card.due || String(note.frontmatter.created || "");
          if (dateForFilter >= twoWeeksAgo) {
            done.push(card);
          }
          continue;
        }

        // Active tasks: open or in-progress
        const due = card.due;
        if (!due) {
          someday.push(card);
        } else if (isOverdue(due, today) || isDueOn(due, today)) {
          todayCol.push(card);
        } else if (due <= weekFromNow) {
          soon.push(card);
        } else {
          backlog.push(card);
        }
      }

      // Sort: Backlog, Today, Soon by due ascending then priority
      const sortByDueThenPriority = (a: CardData, b: CardData) => {
        const dueCmp = (a.due ?? "9999").localeCompare(b.due ?? "9999");
        if (dueCmp !== 0) return dueCmp;
        return (PRIORITY_WEIGHT[a.priority] ?? 2) - (PRIORITY_WEIGHT[b.priority] ?? 2);
      };

      backlog.sort(sortByDueThenPriority);
      todayCol.sort(sortByDueThenPriority);
      soon.sort(sortByDueThenPriority);

      // Someday: created descending (newest first)
      someday.sort((a, b) => b.filePath.localeCompare(a.filePath));

      // Done: newest first by due or created
      done.sort((a, b) => (b.due ?? "").localeCompare(a.due ?? ""));

      columns = [
        { id: "backlog", title: "Backlog", cards: backlog },
        { id: "today", title: "Today", cards: todayCol },
        { id: "soon", title: "Soon", cards: soon },
        { id: "someday", title: "Someday", cards: someday },
        { id: "done", title: "Done", cards: done },
      ];
    } finally {
      loading = false;
    }
  }

  function noteToCard(note: ParsedNote): CardData {
    const due = typeof note.frontmatter.due === "string" && note.frontmatter.due
      ? note.frontmatter.due
      : null;
    return {
      filePath: note.file.path,
      title: String(note.frontmatter.title || note.file.basename),
      due,
      priority: String(note.frontmatter.priority || "normal"),
      project: note.frontmatter.project ? String(note.frontmatter.project) : null,
      waitingOn: note.frontmatter["waiting-on"]
        ? String(note.frontmatter["waiting-on"])
        : null,
      overdue: due ? isOverdue(due, today) : false,
    };
  }

  // --- Drag callbacks ---

  function handleCardDragStart(filePath: string): void {
    draggedFilePath = filePath;
  }

  function handleCardDragEnd(): void {
    draggedFilePath = null;
  }

  // --- Drop handler ---

  async function handleColumnDrop(columnId: string): Promise<void> {
    const filePath = draggedFilePath;
    draggedFilePath = null;
    if (!filePath) return;

    const file = app.vault.getAbstractFileByPath(filePath) as TFile | null;
    if (!file) return;

    switch (columnId) {
      case "backlog": {
        // Backlog requires due > 7 days out; push to 14 days if not already there
        const backlogNote = await vaultParser.getNote(file);
        const existingDue = typeof backlogNote.frontmatter.due === "string"
          ? backlogNote.frontmatter.due : "";
        const minBacklogDate = addDays(today, 8);
        const newDue = existingDue > minBacklogDate ? existingDue : addDays(today, 14);
        await frontmatterWriter.updateFields(file, {
          status: "open",
          due: newDue,
        });
        break;
      }
      case "today":
        await frontmatterWriter.updateFields(file, {
          status: "open",
          due: today,
        });
        break;
      case "soon": {
        // Soon = due within 1–7 days from today.
        // Keep existing due if already in range, otherwise set to 3 days out.
        const soonNote = await vaultParser.getNote(file);
        const soonDue = typeof soonNote.frontmatter.due === "string"
          ? soonNote.frontmatter.due : "";
        const weekFromNow = addDays(today, 7);
        const inSoonRange = soonDue > today && soonDue <= weekFromNow;
        await frontmatterWriter.updateFields(file, {
          status: "open",
          due: inSoonRange ? soonDue : addDays(today, 3),
        });
        break;
      }
      case "someday":
        await frontmatterWriter.updateFields(file, {
          status: "open",
          due: "",
        });
        break;
      case "done":
        await frontmatterWriter.setField(file, "status", "done");
        break;
    }

    // Invalidate cache for the modified file before reloading,
    // so we don't read stale frontmatter from the parser cache
    vaultParser.invalidate(filePath);
    await loadData(false);
  }

  function openNote(filePath: string): void {
    void app.workspace.openLinkText(filePath, "");
  }
</script>

<div class="kanban-board">
  {#if loading}
    <div class="kanban-loading">Loading...</div>
  {:else}
    {#each columns as col (col.id)}
      <KanbanColumn
        id={col.id}
        title={col.title}
        cards={col.cards}
        onDrop={handleColumnDrop}
        onOpenNote={openNote}
        onCardDragStart={handleCardDragStart}
        onCardDragEnd={handleCardDragEnd}
      />
    {/each}
  {/if}
</div>

<style>
  .kanban-board {
    display: flex;
    gap: 8px;
    padding: 10px;
    height: 100%;
    overflow-x: auto;
    font-family: var(--font-interface);
    color: var(--text-normal);
  }

  .kanban-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    color: var(--text-faint);
    font-size: 0.9em;
    padding: 40px 0;
  }
</style>
