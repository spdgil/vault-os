<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { MarkdownRenderer, Component } from "obsidian";
  import type { App, TFile } from "obsidian";
  import type { VaultParser, ParsedNote } from "../vault-parser";
  import type { FrontmatterWriter } from "../frontmatter-writer";
  import {
    todayString,
    formatDisplayDate,
    parseDate,
    isOverdue,
    isDueOn,
    slugify,
  } from "../date-utils";
  import { parseLifeSystem } from "../life-system-parser";
  import type { Domain, Practice } from "../life-system-parser";
  import { VAULT_PATHS } from "../constants";
  import TaskItem from "./TaskItem.svelte";
  import CaptureInput from "./CaptureInput.svelte";

  export let app: App;
  export let vaultParser: VaultParser;
  export let frontmatterWriter: FrontmatterWriter;

  // --- Types ---

  interface TaskData {
    file: TFile;
    title: string;
    status: string;
    priority: string;
    due: string | null;
  }

  interface WorkItem {
    file: TFile;
    title: string;
    noteType: string;
    status: string;
  }

  interface DomainWork {
    domain: string;
    items: WorkItem[];
  }

  interface DomainPractices {
    domain: string;
    practices: Practice[];
  }

  // --- State ---

  let today = todayString();
  let displayDate = formatDisplayDate(parseDate(today)!);
  let loading = true;

  let overdueTasks: TaskData[] = [];
  let dueTodayTasks: TaskData[] = [];
  let captures: string[] = [];
  let domainWork: DomainWork[] = [];
  let domainPractices: DomainPractices[] = [];
  let insightsBody: string | null = null;

  // --- Lifecycle ---

  export function refresh(): void {
    today = todayString();
    displayDate = formatDisplayDate(parseDate(today)!);
    void loadData(false);
  }

  onMount(() => {
    void loadData(true);
  });

  // --- Data loading ---

  async function loadData(showLoading: boolean): Promise<void> {
    if (showLoading) loading = true;

    try {
      // Domains load first — active work and practices depend on them
      const domains = await loadDomains();

      await Promise.all([
        loadTasks(),
        loadCaptures(),
        loadActiveWork(domains),
        loadPractices(domains),
        loadInsights(),
      ]);
    } finally {
      loading = false;
    }
  }

  async function loadDomains(): Promise<Domain[]> {
    const note = await vaultParser.getNoteByPath(VAULT_PATHS.lifeSystem);
    if (!note) return [];
    const lifeSystem = parseLifeSystem(note.body);
    return lifeSystem.domains;
  }

  async function loadTasks(): Promise<void> {
    const allTasks = await vaultParser.query({
      type: "task",
      folder: "tasks",
    });

    const newOverdue: TaskData[] = [];
    const newDueToday: TaskData[] = [];

    for (const note of allTasks) {
      const status = String(note.frontmatter.status || "");
      if (
        status === "done" ||
        status === "completed" ||
        status === "cancelled"
      )
        continue;

      const due = note.frontmatter.due;
      if (typeof due !== "string" || !due) continue;

      const task = noteToTask(note);

      if (isOverdue(due, today)) {
        newOverdue.push(task);
      } else if (isDueOn(due, today)) {
        newDueToday.push(task);
      }
    }

    overdueTasks = newOverdue.sort((a, b) =>
      (a.due ?? "").localeCompare(b.due ?? ""),
    );
    dueTodayTasks = newDueToday;
  }

  function noteToTask(note: ParsedNote): TaskData {
    return {
      file: note.file,
      title: String(note.frontmatter.title || note.file.basename),
      status: String(note.frontmatter.status || "open"),
      priority: String(note.frontmatter.priority || "normal"),
      due:
        typeof note.frontmatter.due === "string"
          ? note.frontmatter.due
          : null,
    };
  }

  async function loadCaptures(): Promise<void> {
    const dailyPath = `${VAULT_PATHS.dailyNotes}/${today}.md`;
    const note = await vaultParser.getNoteByPath(dailyPath);

    if (!note) {
      captures = [];
      return;
    }

    const items: string[] = [];
    for (const line of note.body.split("\n")) {
      const match = line.match(/^[-*]\s+(?:\[( |x)\]\s+)?(.+)/);
      if (match && match[1] !== "x") {
        items.push(match[2].trim());
      }
    }
    captures = items;
  }

  async function loadActiveWork(domains: Domain[]): Promise<void> {
    // Build slug → domain name mapping (domain names + individual areas)
    const areaToDomain = new Map<string, string>();
    for (const domain of domains) {
      areaToDomain.set(slugify(domain.name), domain.name);
      for (const area of domain.areas) {
        areaToDomain.set(slugify(area), domain.name);
      }
    }

    const [projects, writing, tasks] = await Promise.all([
      vaultParser.query({ type: ["code-project"] }),
      vaultParser.query({ type: "writing" }),
      vaultParser.query({ type: "task" }),
    ]);

    const activeProjects = projects.filter(
      (n) => n.frontmatter.status === "active",
    );
    const activeWriting = writing.filter((n) => {
      const s = n.frontmatter.status;
      return s && s !== "done" && s !== "published" && s !== "abandoned";
    });
    const inProgressTasks = tasks.filter(
      (n) => n.frontmatter.status === "in-progress",
    );

    const grouped = new Map<string, WorkItem[]>();

    for (const note of [...activeProjects, ...activeWriting, ...inProgressTasks]) {
      const domainName = resolveDomain(note, areaToDomain);
      if (!grouped.has(domainName)) grouped.set(domainName, []);
      grouped.get(domainName)!.push({
        file: note.file,
        title: String(note.frontmatter.title || note.file.basename),
        noteType: String(note.type || "note"),
        status: String(note.frontmatter.status || ""),
      });
    }

    domainWork = Array.from(grouped.entries())
      .map(([domain, items]) => ({ domain, items }))
      .sort((a, b) => {
        if (a.domain === "Other") return 1;
        if (b.domain === "Other") return -1;
        return a.domain.localeCompare(b.domain);
      });
  }

  function resolveDomain(
    note: ParsedNote,
    areaToDomain: Map<string, string>,
  ): string {
    // Try area field
    const area = String(note.frontmatter.area || "");
    if (area) {
      const domain = areaToDomain.get(slugify(area));
      if (domain) return domain;
    }

    // Try folder path: areas/{slug}/...
    const pathMatch = note.path.match(/^areas\/([^/]+)\//);
    if (pathMatch) {
      const domain = areaToDomain.get(pathMatch[1]);
      if (domain) return domain;
    }

    return area || "Other";
  }

  async function loadPractices(domains: Domain[]): Promise<void> {
    domainPractices = domains
      .filter((d) => d.practices.length > 0)
      .map((d) => ({ domain: d.name, practices: d.practices }));
  }

  async function loadInsights(): Promise<void> {
    const insightsPath = `${VAULT_PATHS.insights}/${today}.md`;
    const note = await vaultParser.getNoteByPath(insightsPath);
    insightsBody = note ? note.body.trim() || null : null;
  }

  // --- Actions ---

  async function toggleTask(task: TaskData): Promise<void> {
    const newStatus = task.status === "done" ? "open" : "done";
    await frontmatterWriter.setField(task.file, "status", newStatus);
  }

  async function addCapture(text: string): Promise<void> {
    const dailyPath = `${VAULT_PATHS.dailyNotes}/${today}.md`;
    const existing = app.vault.getAbstractFileByPath(dailyPath);

    if (!existing) {
      // Ensure folder exists
      await ensureFolderExists(VAULT_PATHS.dailyNotes);
      await app.vault.create(
        dailyPath,
        "```calendar-nav\n```\n\n- " + text + "\n",
      );
    } else {
      const content = await app.vault.read(existing as TFile);
      await app.vault.modify(existing as TFile, content + "\n- " + text);
    }
  }

  async function ensureFolderExists(folderPath: string): Promise<void> {
    if (app.vault.getAbstractFileByPath(folderPath)) return;
    const parts = folderPath.split("/");
    let current = "";
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      if (!app.vault.getAbstractFileByPath(current)) {
        await app.vault.createFolder(current);
      }
    }
  }

  function openNote(file: TFile): void {
    void app.workspace.openLinkText(file.path, "");
  }

  function openLink(linkPath: string): void {
    void app.workspace.openLinkText(linkPath, "");
  }

  // --- Markdown rendering (for insights panel) ---

  function renderMarkdown(
    node: HTMLElement,
    content: string | null,
  ): { update: (c: string | null) => void; destroy: () => void } {
    let comp: Component | null = null;

    function render(text: string | null): void {
      node.innerHTML = "";
      comp?.unload();
      comp = null;
      if (!text) return;
      comp = new Component();
      comp.load();
      void MarkdownRenderer.render(app, text, node, "", comp);
    }

    render(content);

    return {
      update(newContent: string | null) {
        render(newContent);
      },
      destroy() {
        comp?.unload();
      },
    };
  }
</script>

<div class="day-view">
  <header class="day-view-header">
    <h2>{displayDate}</h2>
  </header>

  {#if loading}
    <div class="day-view-loading">Loading...</div>
  {:else}
    <!-- Tasks -->
    <section class="day-view-section">
      <h3>Tasks</h3>
      {#if overdueTasks.length > 0}
        <div class="task-group">
          <h4 class="task-group-label overdue-label">
            Overdue ({overdueTasks.length})
          </h4>
          {#each overdueTasks as task (task.file.path)}
            <TaskItem
              title={task.title}
              due={task.due}
              status={task.status}
              priority={task.priority}
              overdue={true}
              onToggle={() => toggleTask(task)}
              onOpen={() => openNote(task.file)}
            />
          {/each}
        </div>
      {/if}
      {#if dueTodayTasks.length > 0}
        <div class="task-group">
          <h4 class="task-group-label">Due today ({dueTodayTasks.length})</h4>
          {#each dueTodayTasks as task (task.file.path)}
            <TaskItem
              title={task.title}
              due={task.due}
              status={task.status}
              priority={task.priority}
              onToggle={() => toggleTask(task)}
              onOpen={() => openNote(task.file)}
            />
          {/each}
        </div>
      {/if}
      {#if overdueTasks.length === 0 && dueTodayTasks.length === 0}
        <p class="empty-state">No tasks due</p>
      {/if}
    </section>

    <!-- Captures -->
    <section class="day-view-section">
      <h3>Captures</h3>
      {#if captures.length > 0}
        <ul class="capture-list">
          {#each captures as capture}
            <li class="capture-item">{capture}</li>
          {/each}
        </ul>
      {:else}
        <p class="empty-state">No captures yet</p>
      {/if}
      <CaptureInput onSubmit={addCapture} />
    </section>

    <!-- Active Work -->
    <section class="day-view-section">
      <h3>Active Work</h3>
      {#if domainWork.length > 0}
        {#each domainWork as group}
          <div class="domain-group">
            <h4 class="domain-label">{group.domain}</h4>
            {#each group.items as item}
              <button class="work-item" on:click={() => openNote(item.file)}>
                <span class="work-type-badge">{item.noteType}</span>
                <span class="work-title">{item.title}</span>
              </button>
            {/each}
          </div>
        {/each}
      {:else}
        <p class="empty-state">No active work</p>
      {/if}
    </section>

    <!-- Practices -->
    <section class="day-view-section">
      <h3>Practices</h3>
      {#if domainPractices.length > 0}
        {#each domainPractices as group}
          <div class="domain-group">
            <h4 class="domain-label">{group.domain}</h4>
            {#each group.practices as practice}
              {#if practice.linkedNote}
                <button
                  class="practice-item has-link"
                  on:click={() => openLink(practice.linkedNote ?? "")}
                >
                  <span>{practice.text}</span>
                  <span class="link-arrow">→</span>
                </button>
              {:else}
                <div class="practice-item">
                  <span>{practice.text}</span>
                </div>
              {/if}
            {/each}
          </div>
        {/each}
      {:else}
        <p class="empty-state">No life system found</p>
      {/if}
    </section>

    <!-- Claude Insights -->
    <section class="day-view-section insights-section">
      <h3>Claude Insights</h3>
      {#if insightsBody}
        <div class="insights-content" use:renderMarkdown={insightsBody}></div>
      {:else}
        <p class="empty-state">No insights for today</p>
      {/if}
    </section>
  {/if}
</div>

<style>
  .day-view {
    padding: 16px 20px;
    font-family: var(--font-interface);
    color: var(--text-normal);
    max-width: 800px;
    overflow-y: auto;
  }

  .day-view-header h2 {
    font-size: 1.4em;
    font-weight: 600;
    margin: 0 0 16px 0;
    color: var(--text-normal);
  }

  .day-view-loading {
    color: var(--text-faint);
    text-align: center;
    padding: 40px;
  }

  .day-view-section {
    margin-bottom: 16px;
    background: var(--background-secondary);
    border-radius: 8px;
    padding: 12px 16px;
    border: 1px solid var(--background-modifier-border);
  }

  .day-view-section h3 {
    font-size: 0.8em;
    font-weight: 600;
    margin: 0 0 8px 0;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .empty-state {
    color: var(--text-faint);
    font-style: italic;
    font-size: 0.9em;
    margin: 4px 0;
  }

  /* Task groups */
  .task-group {
    margin-bottom: 4px;
  }

  .task-group-label {
    font-size: 0.8em;
    color: var(--text-muted);
    margin: 8px 0 4px 0;
    font-weight: 500;
  }

  .task-group-label:first-child {
    margin-top: 0;
  }

  .overdue-label {
    color: var(--text-error);
  }

  /* Domain groups (shared by active work + practices) */
  .domain-group {
    margin-bottom: 8px;
  }

  .domain-group:last-child {
    margin-bottom: 0;
  }

  .domain-label {
    font-size: 0.8em;
    color: var(--text-accent);
    margin: 8px 0 4px 0;
    font-weight: 500;
  }

  .domain-group:first-child .domain-label {
    margin-top: 0;
  }

  /* Active work items */
  .work-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
    cursor: pointer;
    background: none;
    border: none;
    font: inherit;
    color: inherit;
    text-align: left;
    width: 100%;
  }

  .work-item:hover .work-title {
    color: var(--text-accent);
  }

  .work-type-badge {
    font-size: 0.7em;
    background: var(--background-modifier-border);
    color: var(--text-muted);
    padding: 2px 6px;
    border-radius: 4px;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .work-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Practice items */
  .practice-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 0;
    background: none;
    border: none;
    font: inherit;
    color: inherit;
    text-align: left;
    width: 100%;
  }

  .practice-item.has-link {
    cursor: pointer;
  }

  .practice-item.has-link:hover {
    color: var(--text-accent);
  }

  .link-arrow {
    color: var(--text-faint);
    flex-shrink: 0;
    margin-left: 8px;
  }

  /* Captures */
  .capture-list {
    list-style: none;
    padding: 0;
    margin: 0 0 4px 0;
  }

  .capture-item {
    padding: 4px 0;
    border-bottom: 1px solid var(--background-modifier-border);
    font-size: 0.95em;
  }

  .capture-item:last-child {
    border-bottom: none;
  }

  /* Insights */
  .insights-section :global(.insights-content) {
    line-height: 1.6;
    font-size: 0.95em;
  }
</style>
