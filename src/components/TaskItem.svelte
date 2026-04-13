<script lang="ts">
  export let title: string;
  export let due: string | null = null;
  export let status: string;
  export let priority: string = "normal";
  export let overdue: boolean = false;
  export let onToggle: () => void;
  export let onOpen: () => void;

  $: done = status === "done";
</script>

<div class="task-item">
  <label class="task-checkbox">
    <input type="checkbox" checked={done} on:change={onToggle} />
  </label>
  <button class="task-content" on:click={onOpen}>
    <span class="task-title" class:done>{title}</span>
    {#if due}
      <span class="task-due" class:overdue>{due}</span>
    {/if}
    {#if priority !== "normal"}
      <span class="task-priority {priority}">{priority}</span>
    {/if}
  </button>
</div>

<style>
  .task-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
  }

  .task-checkbox {
    flex-shrink: 0;
    display: flex;
    align-items: center;
  }

  .task-checkbox input {
    cursor: pointer;
    accent-color: var(--interactive-accent);
    margin: 0;
  }

  .task-content {
    display: flex;
    align-items: center;
    gap: 8px;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    font: inherit;
    color: inherit;
    text-align: left;
    flex: 1;
    min-width: 0;
  }

  .task-content:hover .task-title {
    color: var(--text-accent);
  }

  .task-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .task-title.done {
    text-decoration: line-through;
    color: var(--text-faint);
  }

  .task-due {
    font-size: 0.8em;
    color: var(--text-muted);
    white-space: nowrap;
    flex-shrink: 0;
  }

  .task-due.overdue {
    color: var(--text-error);
  }

  .task-priority {
    font-size: 0.75em;
    padding: 1px 6px;
    border-radius: 4px;
    background: var(--background-modifier-border);
    white-space: nowrap;
    flex-shrink: 0;
  }

  .task-priority.high,
  .task-priority.urgent {
    color: var(--text-error);
  }
</style>
