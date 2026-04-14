/**
 * Pure functions for parsing markdown frontmatter and body.
 * No Obsidian dependencies — fully testable in isolation.
 */

export interface ParsedMarkdown {
  frontmatter: Record<string, unknown>;
  body: string;
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

/**
 * Parse YAML frontmatter and body from raw markdown text.
 * Returns empty frontmatter if no valid frontmatter block is found.
 */
export function parseMarkdown(raw: string): ParsedMarkdown {
  const match = raw.match(FRONTMATTER_RE);
  if (!match) {
    return { frontmatter: {}, body: raw };
  }
  return {
    frontmatter: parseYamlFrontmatter(match[1]),
    body: match[2],
  };
}

/**
 * Minimal YAML frontmatter parser.
 * Handles the subset of YAML used in Obsidian frontmatter:
 * scalar values, arrays (both inline and list-style), and quoted strings.
 */
export function parseYamlFrontmatter(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = yaml.split("\n");
  let currentKey: string | null = null;
  let currentArray: string[] | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Array continuation: "- value"
    if (currentKey && currentArray !== null && /^\s+-\s+/.test(line)) {
      const value = line.replace(/^\s+-\s+/, "").trim();
      currentArray.push(unquote(value));
      continue;
    }

    // Flush pending array (empty means the value was bare "key:", not a list)
    if (currentKey && currentArray !== null) {
      result[currentKey] = currentArray.length > 0 ? currentArray : null;
      currentKey = null;
      currentArray = null;
    }

    // Key: value line
    const kvMatch = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (!kvMatch) continue;

    const key = kvMatch[1];
    const rawValue = kvMatch[2].trim();

    // Inline array: [a, b, c]
    if (rawValue.startsWith("[") && rawValue.endsWith("]")) {
      const inner = rawValue.slice(1, -1).trim();
      if (inner === "") {
        result[key] = [];
      } else {
        result[key] = inner.split(",").map((s) => unquote(s.trim()));
      }
      continue;
    }

    // Empty value — might be start of list array or just empty
    if (rawValue === "") {
      currentKey = key;
      currentArray = [];
      continue;
    }

    // Scalar value
    result[key] = parseScalar(rawValue);
  }

  // Flush trailing array
  if (currentKey && currentArray !== null) {
    result[currentKey] = currentArray.length > 0 ? currentArray : null;
  }

  return result;
}

function unquote(s: string): string {
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    return s.slice(1, -1);
  }
  return s;
}

function parseScalar(value: string): unknown {
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "null") return null;
  const num = Number(value);
  if (!isNaN(num) && value !== "") return num;
  return unquote(value);
}
