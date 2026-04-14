<script lang="ts">
  export let title: string;
  export let due: string | null = null;
  export let priority: string = "normal";
  export let project: string | null = null;
  export let waitingOn: string | null = null;
  export let overdue: boolean = false;
  export let onOpen: () => void;
  export let onDragStart: () => void;
  export let onDragEnd: () => void;

  function handleDragStart(e: DragEvent) {
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      // Required for Firefox/Electron to enable the drag
      e.dataTransfer.setData("text/plain", "");
    }
    onDragStart();
  }

  function handleDragEnd(e: DragEvent) {
    e.stopPropagation();
    onDragEnd();
  }
</script>

<div
  class="kanban-card"
  role="listitem"
  draggable="true"
  on:dragstart={handleDragStart}
  on:dragend={handleDragEnd}
>
  <button class="card-title" on:click|stopPropagation={onOpen}>
    {title}
  </button>
  {#if due || priority !== "normal"}
    <div class="card-meta">
      {#if due}
        <span class="card-due" class:overdue>{due}</span>
      {/if}
      {#if priority !== "normal"}
        <span class="card-priority {priority}">{priority}</span>
      {/if}
    </div>
  {/if}
  {#if project || waitingOn}
    <div class="card-footer">
      {#if project}
        <span class="card-project">{project}</span>
      {/if}
      {#if waitingOn}
        <span class="card-waiting">{waitingOn}</span>
      {/if}
    </div>
  {/if}
</div>

<style>
  .kanban-card {
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    padding: 8px 10px;
    cursor: grab;
  }

  .kanban-card:hover {
    border-color: var(--interactive-accent);
  }

  .kanban-card:active {
    cursor: grabbing;
    opacity: 0.7;
  }

  .card-title {
    display: block;
    background: none;
    border: none;
    padding: 0;
    margin: 0;
    font: inherit;
    font-size: 0.82em;
    line-height: 1.4;
    color: var(--text-normal);
    text-align: left;
    cursor: pointer;
    width: 100%;
    white-space: normal;
    word-wrap: break-word;
    overflow-wrap: break-word;
  }

  .card-title:hover {
    color: var(--text-accent);
  }

  .card-meta {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 5px;
    margin-top: 5px;
  }

  .card-due {
    font-size: 0.7em;
    color: var(--text-faint);
  }

  .card-due.overdue {
    color: var(--text-error);
    font-weight: 600;
  }

  .card-priority {
    font-size: 0.65em;
    padding: 0 5px;
    border-radius: 3px;
    background: var(--background-modifier-border);
    color: var(--text-muted);
    font-weight: 500;
    line-height: 1.5;
  }

  .card-priority.high,
  .card-priority.urgent {
    color: var(--text-error);
    background: rgba(var(--color-red-rgb, 255, 0, 0), 0.1);
  }

  .card-footer {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 5px;
    margin-top: 5px;
    padding-top: 4px;
    border-top: 1px solid var(--background-modifier-border);
  }

  .card-project {
    font-size: 0.65em;
    color: var(--text-muted);
  }

  .card-waiting {
    font-size: 0.65em;
    color: var(--text-accent);
    font-style: italic;
  }

  .card-waiting::before {
    content: "\21BB  ";
  }
</style>
