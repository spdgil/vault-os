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
        status === "cancelled" ||
        status === "deferred"
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

    // Extract only unchecked checkbox items (- [ ] text) from the daily note.
    // Bare bullets without checkboxes are structured planning content, not captures.
    const items: string[] = [];
    for (const line of note.body.split("\n")) {
      const match = line.match(/^[-*]\s+\[ \]\s+(.+)/);
      if (match) {
        items.push(match[1].trim());
      }
    }
    captures = items;
  }

  async function loadActiveWork(domains: Domain[]): Promise<void> {
    // Build slug → domain name mapping
    // Maps domain name slugs, full area slugs, and short area names
    // (text before : or parenthesis) to handle real frontmatter values
    // like "kingdom", "secondmuse", "agrifutures"
    const areaToDomain = new Map<string, string>();
    for (const domain of domains) {
      areaToDomain.set(slugify(domain.name), domain.name);
      for (const area of domain.areas) {
        areaToDomain.set(slugify(area), domain.name);
        // Extract short name before colon or parenthesis
        const shortMatch = area.match(/^([^(:,]+)/);
        if (shortMatch) {
          const shortSlug = slugify(shortMatch[1].trim());
          if (shortSlug) {
            areaToDomain.set(shortSlug, domain.name);
          }
        }
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
      const s = String(n.frontmatter.status || "");
      // Only show writing actively being drafted, not outlines or sketches
      return s.startsWith("draft") || s === "in-progress" || s === "review";
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
      const areaSlug = slugify(area);

      // Exact match
      const exact = areaToDomain.get(areaSlug);
      if (exact) return exact;

      // Prefix match: "kingdom" matches "kingdom-of-god"
      if (areaSlug.length >= 3) {
        for (const [slug, domain] of areaToDomain) {
          if (slug.startsWith(areaSlug + "-") || areaSlug.startsWith(slug + "-")) {
            return domain;
          }
        }
      }
    }

    // Try folder path: areas/{slug}/...
    const pathMatch = note.path.match(/^areas\/([^/]+)\//);
    if (pathMatch) {
      const slug = pathMatch[1];
      const domain = areaToDomain.get(slug);
      if (domain) return domain;
      // Prefix match on folder too
      for (const [s, d] of areaToDomain) {
        if (s.startsWith(slug + "-") || slug.startsWith(s + "-")) {
          return d;
        }
      }
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
        "```calendar-nav\n```\n\n- [ ] " + text + "\n",
      );
    } else {
      const content = await app.vault.read(existing as TFile);
      await app.vault.modify(existing as TFile, content + "\n- [ ] " + text);
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
          {#each captures as capture, i (i)}
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
    padding: 12px 0;
    font-family: var(--font-interface);
    color: var(--text-normal);
    max-width: 800px;
    overflow-y: auto;
  }

  .day-view-header {
    padding: 4px 16px 12px;
  }

  .day-view-header h2 {
    font-size: 1.25em;
    font-weight: 700;
    margin: 0;
    color: var(--text-normal);
    line-height: 1.3;
  }

  .day-view-loading {
    color: var(--text-faint);
    text-align: center;
    padding: 40px 16px;
    font-size: 0.9em;
  }

  /* Sections — flat layout with dividers */
  .day-view-section {
    padding: 8px 0;
    border-top: 1px solid var(--background-modifier-border);
  }

  .day-view-section h3 {
    font-size: 0.7em;
    font-weight: 600;
    margin: 0;
    padding: 4px 16px 6px;
    color: var(--text-faint);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .empty-state {
    color: var(--text-faint);
    font-size: 0.85em;
    margin: 0;
    padding: 6px 16px;
  }

  /* Task groups */
  .task-group {
    margin-bottom: 2px;
  }

  .task-group-label {
    font-size: 0.7em;
    color: var(--text-muted);
    margin: 0;
    padding: 6px 16px 2px;
    font-weight: 600;
    letter-spacing: 0.03em;
  }

  .task-group-label:first-child {
    padding-top: 0;
  }

  .overdue-label {
    color: var(--text-error);
  }

  /* Domain groups (shared by active work + practices) */
  .domain-group {
    margin-bottom: 4px;
  }

  .domain-group:last-child {
    margin-bottom: 0;
  }

  .domain-label {
    font-size: 0.7em;
    color: var(--text-accent);
    margin: 0;
    padding: 6px 16px 2px;
    font-weight: 600;
    letter-spacing: 0.03em;
  }

  .domain-group:first-child .domain-label {
    padding-top: 0;
  }

  /* Active work items */
  .work-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 16px;
    cursor: pointer;
    background: none;
    border: none;
    border-radius: 0;
    font: inherit;
    color: inherit;
    text-align: left;
    width: 100%;
  }

  .work-item:hover {
    background: var(--background-modifier-hover);
  }

  .work-type-badge {
    font-size: 0.7em;
    background: var(--background-modifier-border);
    color: var(--text-muted);
    padding: 1px 6px;
    border-radius: 3px;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .work-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.9em;
  }

  /* Practice items */
  .practice-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 5px 16px;
    background: none;
    border: none;
    border-radius: 0;
    font: inherit;
    font-size: 0.9em;
    color: inherit;
    text-align: left;
    width: 100%;
  }

  .practice-item.has-link {
    cursor: pointer;
  }

  .practice-item.has-link:hover {
    background: var(--background-modifier-hover);
  }

  .link-arrow {
    color: var(--text-faint);
    flex-shrink: 0;
    margin-left: 8px;
    font-size: 0.85em;
  }

  /* Captures */
  .capture-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .capture-item {
    padding: 5px 16px;
    font-size: 0.9em;
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .capture-item:last-child {
    border-bottom: none;
  }

  /* Insights */
  .insights-section :global(.insights-content) {
    line-height: 1.6;
    font-size: 0.9em;
    padding: 0 16px;
  }
</style>
