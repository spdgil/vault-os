import { describe, it, expect } from "vitest";
import { parseMarkdown, parseYamlFrontmatter } from "./markdown-parser";

describe("parseYamlFrontmatter", () => {
  it("parses scalar string values", () => {
    const result = parseYamlFrontmatter("title: My Note\nstatus: active");
    expect(result).toEqual({ title: "My Note", status: "active" });
  });

  it("parses quoted strings", () => {
    const result = parseYamlFrontmatter('title: "Hello: World"');
    expect(result).toEqual({ title: "Hello: World" });
  });

  it("parses single-quoted strings", () => {
    const result = parseYamlFrontmatter("title: 'Hello World'");
    expect(result).toEqual({ title: "Hello World" });
  });

  it("parses boolean values", () => {
    const result = parseYamlFrontmatter("sent: false\nrecurring: true");
    expect(result).toEqual({ sent: false, recurring: true });
  });

  it("parses null values", () => {
    const result = parseYamlFrontmatter("due: null");
    expect(result).toEqual({ due: null });
  });

  it("parses numeric values", () => {
    const result = parseYamlFrontmatter("count: 42\nprice: 9.99");
    expect(result).toEqual({ count: 42, price: 9.99 });
  });

  it("parses inline arrays", () => {
    const result = parseYamlFrontmatter("tags: [foo, bar, baz]");
    expect(result).toEqual({ tags: ["foo", "bar", "baz"] });
  });

  it("parses empty inline arrays", () => {
    const result = parseYamlFrontmatter("tags: []");
    expect(result).toEqual({ tags: [] });
  });

  it("parses list-style arrays", () => {
    const yaml = `tags:\n  - identity\n  - domains\n  - system`;
    const result = parseYamlFrontmatter(yaml);
    expect(result).toEqual({ tags: ["identity", "domains", "system"] });
  });

  it("parses empty value followed by non-list as null", () => {
    const yaml = `waiting-on:\ntitle: Hello`;
    const result = parseYamlFrontmatter(yaml);
    expect(result).toEqual({ "waiting-on": null, title: "Hello" });
  });

  it("handles keys with hyphens", () => {
    const result = parseYamlFrontmatter("db-source: readwise\nzotero-key: abc");
    expect(result).toEqual({ "db-source": "readwise", "zotero-key": "abc" });
  });

  it("handles mixed types", () => {
    const yaml = `type: task
title: Fix bug
status: open
priority: normal
recurring: false
tags:
  - urgent
  - backend`;
    const result = parseYamlFrontmatter(yaml);
    expect(result).toEqual({
      type: "task",
      title: "Fix bug",
      status: "open",
      priority: "normal",
      recurring: false,
      tags: ["urgent", "backend"],
    });
  });
});

describe("parseMarkdown", () => {
  it("parses frontmatter and body", () => {
    const md = `---
type: task
title: My Task
tags: []
---

## Description

Some content here.`;

    const result = parseMarkdown(md);
    expect(result.frontmatter).toEqual({
      type: "task",
      title: "My Task",
      tags: [],
    });
    expect(result.body).toContain("## Description");
    expect(result.body).toContain("Some content here.");
  });

  it("returns empty frontmatter when none present", () => {
    const md = "# Just a heading\n\nSome text.";
    const result = parseMarkdown(md);
    expect(result.frontmatter).toEqual({});
    expect(result.body).toBe(md);
  });

  it("handles frontmatter with no body", () => {
    const md = `---
type: reference
---
`;
    const result = parseMarkdown(md);
    expect(result.frontmatter).toEqual({ type: "reference" });
    expect(result.body.trim()).toBe("");
  });

  it("does not treat --- in body as frontmatter delimiter", () => {
    const md = `---
type: note
---

Some text.

---

More text after horizontal rule.`;

    const result = parseMarkdown(md);
    expect(result.frontmatter).toEqual({ type: "note" });
    expect(result.body).toContain("More text after horizontal rule.");
  });
});
