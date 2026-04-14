<script lang="ts">
  import KanbanCard from "./KanbanCard.svelte";

  export let id: string;
  export let title: string;
  export let cards: Array<{
    filePath: string;
    title: string;
    due: string | null;
    priority: string;
    project: string | null;
    waitingOn: string | null;
    overdue: boolean;
  }>;
  export let onDrop: (columnId: string) => void;
  export let onOpenNote: (filePath: string) => void;
  export let onCardDragStart: (filePath: string) => void;
  export let onCardDragEnd: () => void;

  let dragOver = false;
  let dragCounter = 0;

  function handleDragEnter(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter++;
    dragOver = true;
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
  }

  function handleDragLeave(e: DragEvent) {
    e.stopPropagation();
    dragCounter--;
    if (dragCounter === 0) dragOver = false;
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter = 0;
    dragOver = false;
    onDrop(id);
  }
</script>

<div
  class="kanban-column"
  class:drag-over={dragOver}
  role="list"
  on:dragenter={handleDragEnter}
  on:dragover={handleDragOver}
  on:dragleave={handleDragLeave}
  on:drop={handleDrop}
>
  <div class="column-header">
    <span class="column-title">{title}</span>
    <span class="column-count">{cards.length}</span>
  </div>
  <div class="column-cards">
    {#each cards as card (card.filePath)}
      <KanbanCard
        title={card.title}
        due={card.due}
        priority={card.priority}
        project={card.project}
        waitingOn={card.waitingOn}
        overdue={card.overdue}
        onOpen={() => onOpenNote(card.filePath)}
        onDragStart={() => onCardDragStart(card.filePath)}
        onDragEnd={onCardDragEnd}
      />
    {/each}
  </div>
</div>

<style>
  .kanban-column {
    min-width: 200px;
    width: 200px;
    flex-shrink: 0;
    flex-grow: 0;
    display: flex;
    flex-direction: column;
    height: 100%;
    border-radius: 6px;
    border: 1px dashed transparent;
    transition: border-color 0.15s ease, background 0.15s ease;
  }

  .kanban-column.drag-over {
    background: var(--background-modifier-hover);
    border-color: var(--interactive-accent);
  }

  .column-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 4px 8px;
    flex-shrink: 0;
  }

  .column-title {
    font-size: 0.7em;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .column-count {
    font-size: 0.65em;
    color: var(--text-faint);
    background: var(--background-modifier-border);
    padding: 1px 5px;
    border-radius: 8px;
    min-width: 16px;
    text-align: center;
    line-height: 1.4;
  }

  .column-cards {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
    overflow-y: auto;
    padding: 2px;
  }
</style>
