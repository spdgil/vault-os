import { describe, it, expect, vi, beforeEach } from "vitest";
import { VaultParser } from "./vault-parser";
import type { App, TFile, Vault, EventRef } from "obsidian";

/** Create a minimal mock of the Obsidian App for testing VaultParser. */
function createMockApp() {
  const eventHandlers: Record<string, Function[]> = {};
  const files: Map<string, { file: TFile; content: string }> = new Map();

  const vault = {
    on: vi.fn((event: string, handler: Function) => {
      if (!eventHandlers[event]) eventHandlers[event] = [];
      eventHandlers[event].push(handler);
      return { event } as EventRef;
    }),
    offref: vi.fn(),
    read: vi.fn(async (file: TFile) => {
      const entry = files.get(file.path);
      return entry?.content ?? "";
    }),
    getAbstractFileByPath: vi.fn((path: string) => {
      const entry = files.get(path);
      return entry?.file ?? null;
    }),
    getMarkdownFiles: vi.fn(() => {
      return Array.from(files.values()).map((e) => e.file);
    }),
  } as unknown as Vault;

  const app = { vault } as unknown as App;

  function addFile(path: string, content: string) {
    const file = {
      path,
      name: path.split("/").pop()!,
      extension: "md",
      basename: path.split("/").pop()!.replace(".md", ""),
    } as unknown as TFile;
    files.set(path, { file, content });
    return file;
  }

  function triggerEvent(event: string, ...args: unknown[]) {
    for (const handler of eventHandlers[event] || []) {
      handler(...args);
    }
  }

  return { app, vault, addFile, triggerEvent, files };
}

describe("VaultParser", () => {
  let mock: ReturnType<typeof createMockApp>;
  let parser: VaultParser;

  beforeEach(() => {
    mock = createMockApp();
    parser = new VaultParser(mock.app);
    parser.registerEvents();
  });

  it("parses a file and caches the result", async () => {
    const file = mock.addFile("tasks/fix-bug.md", `---
type: task
title: Fix bug
status: open
tags: []
---

Fix the login bug.`);

    const note = await parser.getNote(file);
    expect(note.type).toBe("task");
    expect(note.frontmatter.title).toBe("Fix bug");
    expect(note.body).toContain("Fix the login bug.");
    expect(note.path).toBe("tasks/fix-bug.md");

    // Second call should use cache (vault.read not called again)
    const readCount = vi.mocked(mock.vault.read).mock.calls.length;
    await parser.getNote(file);
    expect(vi.mocked(mock.vault.read).mock.calls.length).toBe(readCount);
  });

  it("invalidates cache on file modify event", async () => {
    const file = mock.addFile("tasks/fix-bug.md", `---
type: task
status: open
---
`);

    await parser.getNote(file);
    mock.triggerEvent("modify", file);

    // After invalidation, should re-read
    mock.files.set(file.path, {
      file,
      content: `---\ntype: task\nstatus: done\n---\n`,
    });
    const note = await parser.getNote(file);
    expect(note.frontmatter.status).toBe("done");
  });

  it("removes cache entry on file delete event", async () => {
    const file = mock.addFile("tasks/fix-bug.md", `---\ntype: task\n---\n`);
    await parser.getNote(file);

    mock.triggerEvent("delete", file);
    // Cache should be cleared — next getNote re-reads
    const readCount = vi.mocked(mock.vault.read).mock.calls.length;
    await parser.getNote(file);
    expect(vi.mocked(mock.vault.read).mock.calls.length).toBe(readCount + 1);
  });

  it("handles file rename by clearing old path and invalidating new", async () => {
    const file = mock.addFile("tasks/old-name.md", `---\ntype: task\n---\n`);
    await parser.getNote(file);

    // Simulate rename
    mock.files.delete("tasks/old-name.md");
    const renamedFile = mock.addFile(
      "tasks/new-name.md",
      `---\ntype: task\n---\n`,
    );
    mock.triggerEvent("rename", renamedFile, "tasks/old-name.md");

    const note = await parser.getNote(renamedFile);
    expect(note.path).toBe("tasks/new-name.md");
  });

  it("queries notes by type", async () => {
    mock.addFile("tasks/a.md", `---\ntype: task\n---\n`);
    mock.addFile("tasks/b.md", `---\ntype: task\n---\n`);
    mock.addFile("people/alice.md", `---\ntype: person\n---\n`);

    const tasks = await parser.getNotesByType("task");
    expect(tasks).toHaveLength(2);
    expect(tasks.every((n) => n.type === "task")).toBe(true);
  });

  it("queries notes by folder", async () => {
    mock.addFile("tasks/a.md", `---\ntype: task\n---\n`);
    mock.addFile("people/alice.md", `---\ntype: person\n---\n`);

    const results = await parser.query({ folder: "tasks" });
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe("tasks/a.md");
  });

  it("queries notes by tag", async () => {
    mock.addFile("notes/a.md", `---\ntype: note\ntags:\n  - urgent\n---\n`);
    mock.addFile("notes/b.md", `---\ntype: note\ntags: []\n---\n`);

    const results = await parser.query({ tag: "urgent" });
    expect(results).toHaveLength(1);
  });

  it("queries with multiple type filter", async () => {
    mock.addFile("a.md", `---\ntype: task\n---\n`);
    mock.addFile("b.md", `---\ntype: person\n---\n`);
    mock.addFile("c.md", `---\ntype: writing\n---\n`);

    const results = await parser.query({ type: ["task", "person"] });
    expect(results).toHaveLength(2);
  });

  it("getNoteByPath returns null for missing files", async () => {
    const result = await parser.getNoteByPath("nonexistent.md");
    expect(result).toBeNull();
  });

  it("clears all cache on clearCache()", async () => {
    const file = mock.addFile("tasks/a.md", `---\ntype: task\n---\n`);
    await parser.getNote(file);

    parser.clearCache();

    const readCount = vi.mocked(mock.vault.read).mock.calls.length;
    await parser.getNote(file);
    expect(vi.mocked(mock.vault.read).mock.calls.length).toBe(readCount + 1);
  });

  it("cleans up event listeners on destroy()", () => {
    parser.destroy();
    expect(vi.mocked(mock.vault.offref)).toHaveBeenCalledTimes(3);
  });
});
