# Vault OS

Obsidian plugin — operating layer for the vault with temporal views.

## PRD

~/vaults/spdgill-base/projects/vault-os/vault-os.md

## Stack

- TypeScript, Svelte 4, esbuild
- Obsidian Plugin API (obsidian npm package)
- No external CSS frameworks — use Obsidian CSS variables

## Build

```
npm run dev    # watch mode (esbuild, inline sourcemaps)
npm run build  # tsc -noEmit -skipLibCheck && esbuild production (minified, no sourcemaps)
```

Output: `main.js` in project root (CJS format, ES2018 target).
Symlinked into the vault at: `~/vaults/spdgill-base/.obsidian/plugins/vault-os/`

## Structure

```
src/
├── main.ts              # Plugin entry point (extends Plugin)
├── constants.ts         # View type IDs, icon names
├── vault-os-view.ts     # ItemView subclass, mounts Svelte components
└── components/          # Svelte components
    └── PlaceholderView.svelte

styles.css               # Global plugin styles (prefer Svelte scoped styles)
manifest.json            # Obsidian community plugin manifest
versions.json            # version → minAppVersion mapping
esbuild.config.mjs       # Build config with svelte + obsidian externals
```

## Architecture

### Two-layer system

Vault OS owns rendering and interaction. Claude Code commands evolve into insight generators that write structured notes to `_inbox/insights/`. Neither layer depends on the other. The vault is the interface between both.

### Five temporal views

Day, Week, Quarter, Year, All — each registered via `registerView()` with a unique view type constant in `constants.ts`. Activated from command palette, ribbon, or sidebar.

### Shared infrastructure (to be built)

- **Vault parser** — reads .md via Obsidian Vault API, parses frontmatter + body, caches with file-event invalidation
- **Life-system parser** — extracts domains, goal hierarchies, areas, practices from `life-system.md` markdown structure
- **Frontmatter writer** — updates fields in place via `processFrontMatter`
- **Note creator** — creates notes from vault `templates/` folder
- **Date utilities** — week/quarter boundaries, relative ranges, shared across views
- **Insights reader** — reads Claude-generated notes from `_inbox/insights/`, graceful when absent

### Vault data sources

| Source | Path pattern | Frontmatter type |
|---|---|---|
| Daily notes | `_inbox/notes/daily/*.md` | journal |
| Yearly plans | `_inbox/plans/yearly/*.md` | yearly-plan |
| Tasks | `tasks/*.md` | task |
| Essays | `areas/*/essays/*.md` | writing |
| Projects | `projects/*/*.md` | code-project, writing |
| Practices | `areas/*/practice-*.md` | practice |
| Reviews | `reviews/*.md` | review |
| Life system | `life-system.md` | reference |
| Vision | `vision.md` | reference |
| People | `people/*.md` | person |
| Claude insights | `_inbox/insights/*.md` | insight |

## Guidelines

### Core principles

- No network calls — everything reads/writes local vault
- The vault is the only source of truth — no separate database or state
- Plugin must work fully without Claude; insights panel is additive
- Use `processFrontMatter` for all frontmatter updates
- Respect file change events from other plugins and external tools
- Follow Obsidian community plugin guidelines (learned from lean-terminal submission)

### Obsidian plugin patterns (from lean-terminal)

**Plugin lifecycle:**
- Load settings first in `onload()`, then register views, ribbon icons, commands, settings tab
- `onunload()`: detach all registered view types with `setTimeout(() => { this.app.workspace.detachLeavesOfType(VIEW_TYPE); }, 0)` — the timeout avoids disrupting Obsidian modals
- Settings via `this.loadData()` / `this.saveData()` — no external storage

**ItemView subclass:**
- Store all resources (timers, observers, child managers) as private instance variables
- Clean up everything in `onClose()` — clear timers, disconnect observers, destroy child components, null references
- Mount Svelte components to `this.containerEl.children[1]` (Obsidian reserves `children[0]`)
- `getViewType()`, `getDisplayText()`, `getIcon()` must return constants

**Settings tab:**
- Always `containerEl.empty()` at start of `display()`
- Use Obsidian's `Setting` class for all UI — `addText`, `addToggle`, `addDropdown`
- Save immediately on every change: `await this.plugin.saveSettings()`

**View activation:**
- Check for existing leaf first before creating a new one
- Use `this.app.workspace.getRightLeaf(false)` or similar for sidebar views

### esbuild

- All Obsidian-provided packages must be in externals: `obsidian`, `electron`, `@codemirror/*`, `@lezer/*`
- All Node.js builtins in externals (via `builtin-modules` package)
- Svelte compiled via `esbuild-svelte` with `svelte-preprocess` and CSS injection
- Output format: CJS (required by Electron's require system)
- Target: ES2018

### Svelte components

- Prefer scoped `<style>` blocks over global `styles.css`
- Use Obsidian CSS variables for all theming: `var(--text-normal)`, `var(--text-muted)`, `var(--text-accent)`, `var(--background-primary)`, `var(--background-secondary)`, `var(--font-interface)`, etc.
- Components must respect light/dark mode and accent colours automatically via these variables
- Destroy Svelte components explicitly in view's `onClose()` — call `component.$destroy()`
- Keep components focused — one view concern per component file

### TypeScript

- Strict mode: `noImplicitAny`, `strictNullChecks`
- Use non-null assertion (`!`) only for properties guaranteed to be initialized in `onload()`
- Export settings as `interface` + `const DEFAULT_SETTINGS` for type inference
- Constants in `constants.ts` — view types, icon names, path patterns

### Testing

- Test infrastructure from day one (lesson from lean-terminal)
- Test vault parser and date utilities independently
- Test frontmatter read/write round-trips

### File conventions

- Source files in `src/`, components in `src/components/`
- One view class per file (e.g., `src/day-view.ts`, `src/week-view.ts`)
- Constants centralized in `src/constants.ts`
- Shared utilities in `src/` at the module level (e.g., `src/vault-parser.ts`, `src/date-utils.ts`)
- Global styles only in `styles.css` when scoped styles aren't possible

## Build plan

1. **Scaffold** (done) — plugin skeleton, placeholder view, build pipeline
2. **Vault parser** — frontmatter extraction, caching, file-event invalidation, life-system parser, frontmatter writer, note creator, tests
3. **Day view** — tasks, captures, domains, practices, insights panel, interactions
4. **Week view** — aggregated daily data, task flow, weekly review generation
5. **All view** — unfiltered query view, filtering/sorting infrastructure
6. **Quarter + Year views** — build on All view's filtering, domain health, epoch goals, reviews
7. **Claude command refactor** — slash commands become insight generators
