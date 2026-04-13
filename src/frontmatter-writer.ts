/**
 * Frontmatter writer — updates fields in place via Obsidian's processFrontMatter.
 */

import type { App, TFile } from "obsidian";

export type FrontmatterUpdate = Record<string, unknown>;

export class FrontmatterWriter {
  constructor(private app: App) {}

  /**
   * Update specific frontmatter fields on a file.
   * Only the provided fields are changed; other fields are left untouched.
   */
  async updateFields(file: TFile, updates: FrontmatterUpdate): Promise<void> {
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      for (const [key, value] of Object.entries(updates)) {
        if (value === undefined) {
          delete fm[key];
        } else {
          fm[key] = value;
        }
      }
    });
  }

  /**
   * Set a single frontmatter field.
   */
  async setField(file: TFile, key: string, value: unknown): Promise<void> {
    await this.updateFields(file, { [key]: value });
  }

  /**
   * Remove a frontmatter field.
   */
  async removeField(file: TFile, key: string): Promise<void> {
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      delete fm[key];
    });
  }

  /**
   * Append a value to a frontmatter array field.
   * Creates the array if it doesn't exist.
   */
  async appendToArray(file: TFile, key: string, value: string): Promise<void> {
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      if (!Array.isArray(fm[key])) {
        fm[key] = [];
      }
      if (!fm[key].includes(value)) {
        fm[key].push(value);
      }
    });
  }

  /**
   * Remove a value from a frontmatter array field.
   */
  async removeFromArray(file: TFile, key: string, value: string): Promise<void> {
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      if (Array.isArray(fm[key])) {
        fm[key] = fm[key].filter((v: string) => v !== value);
      }
    });
  }
}
