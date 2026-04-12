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
npm run dev    # watch mode
npm run build  # typecheck + production build
```

Output: `main.js` in project root. Symlinked into the vault at:
`~/vaults/spdgill-base/.obsidian/plugins/vault-os/`

## Structure

- `src/main.ts` — plugin entry point (extends Plugin)
- `src/constants.ts` — view type IDs, icon names
- `src/vault-os-view.ts` — ItemView subclass, mounts Svelte components
- `src/components/` — Svelte components
- `styles.css` — global plugin styles (prefer Svelte scoped styles)
- `manifest.json` — Obsidian community plugin manifest
- `versions.json` — version-to-minAppVersion mapping

## Guidelines

- Follow Obsidian community plugin guidelines (learned from lean-terminal submission)
- No network calls — everything reads/writes local vault
- Use `processFrontMatter` for frontmatter updates
- Respect file change events from other plugins and external tools
- The vault is the only source of truth — no separate database or state
- Plugin must work fully without Claude; insights panel is additive
