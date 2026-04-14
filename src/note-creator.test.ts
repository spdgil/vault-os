import { describe, it, expect } from "vitest";
import {
  stripTemplaterSyntax,
  buildFrontmatter,
  parseTemplate,
} from "./note-creator";

describe("stripTemplaterSyntax", () => {
  it("removes simple Templater expressions", () => {
    expect(stripTemplaterSyntax('<% tp.date.now("YYYY-MM-DD") %>')).toBe("");
  });

  it("removes multiline Templater expressions", () => {
    const input = `<% await tp.system.suggester(['a', 'b'], ['a', 'b']) %>`;
    expect(stripTemplaterSyntax(input)).toBe("");
  });

  it("leaves non-Templater content intact", () => {
    expect(stripTemplaterSyntax("Hello world")).toBe("Hello world");
  });

  it("removes Templater syntax from mixed content", () => {
    const input = 'date: <% tp.date.now("YYYY-MM-DD") %>\ntitle: My Note';
    expect(stripTemplaterSyntax(input)).toBe("date: \ntitle: My Note");
  });
});

describe("buildFrontmatter", () => {
  it("builds YAML from simple fields", () => {
    const result = buildFrontmatter({ type: "task", title: "Fix bug" });
    expect(result).toBe("---\ntype: task\ntitle: Fix bug\n---");
  });

  it("handles empty string values", () => {
    const result = buildFrontmatter({ type: "task", due: "" });
    expect(result).toContain("due: ");
  });

  it("handles null values", () => {
    const result = buildFrontmatter({ type: "task", due: null });
    expect(result).toContain("due: ");
  });

  it("handles boolean values", () => {
    const result = buildFrontmatter({ recurring: false, sent: true });
    expect(result).toContain("recurring: false");
    expect(result).toContain("sent: true");
  });

  it("handles empty arrays", () => {
    const result = buildFrontmatter({ tags: [] });
    expect(result).toContain("tags: []");
  });

  it("handles arrays with values", () => {
    const result = buildFrontmatter({ tags: ["urgent", "backend"] });
    expect(result).toContain("tags:\n  - urgent\n  - backend");
  });

  it("quotes strings with special characters", () => {
    const result = buildFrontmatter({ title: "Hello: World" });
    expect(result).toContain('title: "Hello: World"');
  });
});

describe("parseTemplate", () => {
  it("parses a template with frontmatter and body", () => {
    const raw = `---
type: task
title: "<% tp.file.title %>"
status: open
priority: normal
tags: []
created: <% tp.date.now("YYYY-MM-DD") %>
recurring: false
---
`;

    const { fields, body } = parseTemplate(raw);
    expect(fields.type).toBe("task");
    expect(fields.title).toBeNull(); // Templater stripped, empty
    expect(fields.status).toBe("open");
    expect(fields.priority).toBe("normal");
    expect(fields.tags).toEqual([]);
    expect(fields.created).toBeNull(); // Templater stripped, bare empty value
    expect(fields.recurring).toBe(false);
    expect(body.trim()).toBe("");
  });

  it("parses a template with body content", () => {
    const raw = `---
type: code-project
title: "<% tp.file.title %>"
tags: []
---

## Dev notes
`;

    const { fields, body } = parseTemplate(raw);
    expect(fields.type).toBe("code-project");
    expect(body).toContain("## Dev notes");
  });

  it("parses a template with no frontmatter", () => {
    const raw = `## Just a heading

Some content.`;

    const { fields, body } = parseTemplate(raw);
    expect(fields).toEqual({});
    expect(body).toContain("## Just a heading");
  });

  it("strips Templater from body too", () => {
    const raw = `---
type: note
---

<% tp.date.now("YYYY-MM-DD") %>

## Content`;

    const { body } = parseTemplate(raw);
    expect(body).not.toContain("<%");
    expect(body).toContain("## Content");
  });

  it("parses templates with suggester expressions", () => {
    const raw = `---
type: correspondence
form: "<% await tp.system.suggester(['email', 'letter'], ['email', 'letter']) %>"
to:
subject:
---
`;

    const { fields } = parseTemplate(raw);
    expect(fields.type).toBe("correspondence");
    expect(fields.form).toBeNull(); // Templater stripped
    expect(fields.to).toBeNull(); // bare empty value
    expect(fields.subject).toBeNull();
  });
});
