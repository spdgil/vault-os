<script lang="ts">
  export let onSubmit: (text: string) => void;

  let value = "";

  function handleSubmit() {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    value = "";
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }
</script>

<div class="capture-input">
  <input
    type="text"
    placeholder="Add a capture..."
    bind:value
    on:keydown={handleKeydown}
  />
  <button on:click={handleSubmit} disabled={!value.trim()}>Add</button>
</div>

<style>
  .capture-input {
    display: flex;
    gap: 8px;
    margin-top: 8px;
  }

  .capture-input input {
    flex: 1;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    padding: 6px 10px;
    color: var(--text-normal);
    font-family: var(--font-interface);
    font-size: 0.9em;
  }

  .capture-input input::placeholder {
    color: var(--text-faint);
  }

  .capture-input input:focus {
    outline: none;
    border-color: var(--interactive-accent);
  }

  .capture-input button {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border: none;
    border-radius: 4px;
    padding: 6px 14px;
    cursor: pointer;
    font-family: var(--font-interface);
    font-size: 0.85em;
    font-weight: 600;
  }

  .capture-input button:hover {
    opacity: 0.9;
  }

  .capture-input button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
</style>
