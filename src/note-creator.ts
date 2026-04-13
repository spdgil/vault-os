/**
 * Note creator — creates notes from vault templates/ folder.
 * Strips Templater syntax and fills in provided values.
 */

import type { App, TFile } from "obsidian";
import { VAULT_PATHS } from "./constants";

export interface NoteCreatorOptions {
  /** Template file name without path (e.g. "task.md" or "journal/daily-note.md") */
  template: string;
  /** Destination folder path */
  folder: string;
  /** File name without extension */
  name: string;
  /** Frontmatter field overrides — applied after template defaults */
  frontmatter?: Record<string, unknown>;
  /** Body content to append after the template body */
  appendBody?: string;
}

/**
 * Strip Templater expressions from a template string.
 * Replaces `<% ... %>` blocks with empty string, since we can't
 * execute Templater JS. Field values are provided via overrides instead.
 */
export function stripTemplaterSyntax(content: string): string {
  return content.replace(/<%[\s\S]*?%>/g, "");
}

/**
 * Build frontmatter YAML string from a key-value record.
 */
export function buildFrontmatter(fields: Record<string, unknown>): string {
  const lines: string[] = ["---"];
  for (const [key, value] of Object.entries(fields)) {
    lines.push(formatYamlField(key, value));
  }
  lines.push("---");
  return lines.join("\n");
}

function formatYamlField(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return `${key}: `;
  }
  if (typeof value === "boolean") {
    return `${key}: ${value}`;
  }
  if (typeof value === "number") {
    return `${key}: ${value}`;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return `${key}: []`;
    return `${key}:\n${value.map((v) => `  - ${v}`).join("\n")}`;
  }
  // String — quote if it contains special characters
  const str = String(value);
  if (/[:#\[\]{}&*!|>'"%@`,?]/.test(str) || str.includes("\n")) {
    return `${key}: "${str.replace(/"/g, '\\"')}"`;
  }
  return `${key}: ${str}`;
}

/**
 * Parse a template file's raw content into default frontmatter fields and body.
 * Strips Templater syntax from values.
 */
export function parseTemplate(raw: string): {
  fields: Record<string, unknown>;
  body: string;
} {
  const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!fmMatch) {
    return { fields: {}, body: stripTemplaterSyntax(raw) };
  }

  const yamlBlock = fmMatch[1];
  const body = stripTemplaterSyntax(fmMatch[2]);

  const fields: Record<string, unknown> = {};
  const lines = yamlBlock.split("\n");
  let currentKey: string | null = null;
  let currentArray: string[] | null = null;

  for (const line of lines) {
    // Array item continuation
    if (currentKey && currentArray !== null && /^\s+-\s+/.test(line)) {
      const val = stripTemplaterSyntax(line.replace(/^\s+-\s+/, "").trim());
      if (val) currentArray.push(val);
      continue;
    }

    // Flush pending array
    if (currentKey && currentArray !== null) {
      fields[currentKey] = currentArray;
      currentKey = null;
      currentArray = null;
    }

    const kvMatch = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (!kvMatch) continue;

    const key = kvMatch[1];
    let rawValue = stripTemplaterSyntax(kvMatch[2]).trim();

    // Inline array
    if (rawValue.startsWith("[") && rawValue.endsWith("]")) {
      const inner = rawValue.slice(1, -1).trim();
      fields[key] = inner ? inner.split(",").map((s) => s.trim()) : [];
      continue;
    }

    // Empty value — possible list start
    if (rawValue === "") {
      currentKey = key;
      currentArray = [];
      continue;
    }

    // Scalars
    if (rawValue === "true") fields[key] = true;
    else if (rawValue === "false") fields[key] = false;
    else if (rawValue === "null") fields[key] = null;
    else {
      // Remove surrounding quotes
      if (
        (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
        (rawValue.startsWith("'") && rawValue.endsWith("'"))
      ) {
        rawValue = rawValue.slice(1, -1);
      }
      fields[key] = rawValue || null;
    }
  }

  // Flush trailing array
  if (currentKey && currentArray !== null) {
    fields[currentKey] = currentArray;
  }

  return { fields, body };
}

export class NoteCreator {
  constructor(private app: App) {}

  /**
   * Create a new note from a template.
   * Returns the created file.
   */
  async create(options: NoteCreatorOptions): Promise<TFile> {
    const { template, folder, name, frontmatter = {}, appendBody = "" } = options;

    // Read template file
    const templatePath = `${VAULT_PATHS.templates}/${template}`;
    const templateFile = this.app.vault.getAbstractFileByPath(templatePath);
    let templateContent = "";
    if (templateFile && "extension" in templateFile) {
      templateContent = await this.app.vault.read(templateFile as TFile);
    }

    const { fields: templateFields, body: templateBody } = parseTemplate(templateContent);

    // Merge: template defaults + caller overrides
    const mergedFields = { ...templateFields, ...frontmatter };

    // Build final content
    const fm = buildFrontmatter(mergedFields);
    const bodyParts = [templateBody, appendBody].filter(Boolean);
    const finalBody = bodyParts.join("\n\n");
    const content = finalBody ? `${fm}\n\n${finalBody}` : `${fm}\n`;

    // Ensure folder exists
    const folderExists = this.app.vault.getAbstractFileByPath(folder);
    if (!folderExists) {
      await this.app.vault.createFolder(folder);
    }

    const filePath = `${folder}/${name}.md`;
    return await this.app.vault.create(filePath, content);
  }

  /**
   * List available template names.
   */
  async listTemplates(): Promise<string[]> {
    const templateFolder = this.app.vault.getAbstractFileByPath(VAULT_PATHS.templates);
    if (!templateFolder) return [];

    const files = this.app.vault.getMarkdownFiles().filter(
      (f) => f.path.startsWith(VAULT_PATHS.templates + "/"),
    );

    return files.map((f) => f.path.slice(VAULT_PATHS.templates.length + 1));
  }
}
