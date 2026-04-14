/**
 * VaultParser — reads .md files via Obsidian Vault API, parses frontmatter + body,
 * caches results with invalidation on file change events.
 */

import type { App, TFile, TAbstractFile, EventRef } from "obsidian";
import { parseMarkdown, type ParsedMarkdown } from "./markdown-parser";

export interface ParsedNote extends ParsedMarkdown {
  file: TFile;
  path: string;
  type: string | null;
}

export interface NoteFilter {
  type?: string | string[];
  folder?: string;
  tag?: string;
}

export class VaultParser {
  private cache = new Map<string, ParsedNote>();
  private eventRefs: EventRef[] = [];

  constructor(private app: App) {}

  /** Start listening for file events. Call from plugin onload(). */
  registerEvents(): void {
    const vault = this.app.vault;

    this.eventRefs.push(
      vault.on("modify", (file: TAbstractFile) => {
        this.invalidate(file.path);
      }),
    );

    this.eventRefs.push(
      vault.on("delete", (file: TAbstractFile) => {
        this.cache.delete(file.path);
      }),
    );

    this.eventRefs.push(
      vault.on("rename", (file: TAbstractFile, oldPath: string) => {
        this.cache.delete(oldPath);
        this.invalidate(file.path);
      }),
    );
  }

  /** Stop listening and clear cache. Call from plugin onunload(). */
  destroy(): void {
    for (const ref of this.eventRefs) {
      this.app.vault.offref(ref);
    }
    this.eventRefs = [];
    this.cache.clear();
  }

  /** Invalidate a single cache entry. */
  invalidate(path: string): void {
    this.cache.delete(path);
  }

  /** Clear the entire cache. */
  clearCache(): void {
    this.cache.clear();
  }

  /** Parse a single file, using cache when available. */
  async getNote(file: TFile): Promise<ParsedNote> {
    const cached = this.cache.get(file.path);
    if (cached) return cached;

    const raw = await this.app.vault.read(file);
    const parsed = parseMarkdown(raw);
    const note: ParsedNote = {
      ...parsed,
      file,
      path: file.path,
      type: typeof parsed.frontmatter.type === "string"
        ? parsed.frontmatter.type
        : null,
    };

    this.cache.set(file.path, note);
    return note;
  }

  /** Get a note by path. Returns null if file doesn't exist. */
  async getNoteByPath(path: string): Promise<ParsedNote | null> {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!file || !("extension" in file)) return null;
    return this.getNote(file as TFile);
  }

  /** Get all markdown files matching a filter. */
  async query(filter: NoteFilter = {}): Promise<ParsedNote[]> {
    let files = this.app.vault.getMarkdownFiles();

    if (filter.folder) {
      const prefix = filter.folder + "/";
      files = files.filter((f) => f.path.startsWith(prefix) || f.path === filter.folder);
    }

    const notes = await Promise.all(files.map((f) => this.getNote(f)));

    return notes.filter((note) => {
      if (filter.type) {
        const types = Array.isArray(filter.type) ? filter.type : [filter.type];
        if (!note.type || !types.includes(note.type)) return false;
      }
      if (filter.tag) {
        const tags = note.frontmatter.tags;
        if (!Array.isArray(tags) || !tags.includes(filter.tag)) return false;
      }
      return true;
    });
  }

  /** Convenience: get all notes of a given type. */
  async getNotesByType(type: string | string[]): Promise<ParsedNote[]> {
    return this.query({ type });
  }
}
