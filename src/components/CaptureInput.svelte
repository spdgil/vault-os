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
    gap: 6px;
    padding: 6px 16px 4px;
  }

  .capture-input input {
    flex: 1;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    padding: 5px 10px;
    color: var(--text-normal);
    font-family: var(--font-interface);
    font-size: 0.85em;
  }

  .capture-input input::placeholder {
    color: var(--text-faint);
  }

  .capture-input input:focus {
    outline: none;
    border-color: var(--interactive-accent);
    box-shadow: 0 0 0 2px rgba(var(--interactive-accent-rgb, 99, 135, 210), 0.15);
  }

  .capture-input button {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border: none;
    border-radius: 4px;
    padding: 5px 12px;
    cursor: pointer;
    font-family: var(--font-interface);
    font-size: 0.8em;
    font-weight: 600;
  }

  .capture-input button:hover {
    background: var(--interactive-accent-hover, var(--interactive-accent));
    opacity: 0.9;
  }

  .capture-input button:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
</style>
