/**
 * Specialised parser for life-system.md.
 * Extracts domains, goal hierarchies, areas of responsibility, and practices
 * from the markdown heading/list structure.
 *
 * Pure function — takes raw markdown string, returns typed structure.
 */

export interface Practice {
  text: string;
  /** Wikilink path if the practice links to a note, e.g. "areas/theosis/practice-prayer" */
  linkedNote: string | null;
}

export interface Domain {
  name: string;
  description: string;
  lifeGoals: string[];
  epochGoals: string[];
  areas: string[];
  practices: Practice[];
}

export interface LifeSystem {
  identity: string;
  domains: Domain[];
}

/**
 * Parse life-system.md content into a typed structure.
 */
export function parseLifeSystem(markdown: string): LifeSystem {
  // Strip frontmatter
  const body = markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");

  const identity = extractIdentity(body);
  const domains = extractDomains(body);

  return { identity, domains };
}

function extractIdentity(body: string): string {
  const identitySection = extractSection(body, "Identity", 2);
  if (!identitySection) return "";

  // Identity is in bold on its own line
  const boldMatch = identitySection.match(/\*\*(.+?)\*\*/);
  return boldMatch ? boldMatch[1] : "";
}

function extractDomains(body: string): Domain[] {
  const domains: Domain[] = [];

  // Find all H2 headings that aren't "Identity"
  const h2Pattern = /^## (.+)$/gm;
  let match: RegExpExecArray | null;
  const headings: { name: string; index: number }[] = [];

  while ((match = h2Pattern.exec(body)) !== null) {
    const name = match[1].trim();
    if (name !== "Identity") {
      headings.push({ name, index: match.index });
    }
  }

  for (let i = 0; i < headings.length; i++) {
    const start = headings[i].index;
    const end = i + 1 < headings.length ? headings[i + 1].index : body.length;
    const section = body.slice(start, end);

    domains.push(parseDomainSection(headings[i].name, section));
  }

  return domains;
}

function parseDomainSection(name: string, section: string): Domain {
  // Description is the italic line after the heading
  const descMatch = section.match(/^\*(.+?)\*$/m);
  const description = descMatch ? descMatch[1] : "";

  const lifeGoals = extractListItems(extractSection(section, "Life goals", 3));
  const epochGoals = extractListItems(extractSection(section, "Epoch goals", 3));
  const areas = extractListItems(extractSection(section, "Areas of responsibility", 3));
  const practices = extractPractices(extractSection(section, "Practices", 3));

  return { name, description, lifeGoals, epochGoals, areas, practices };
}

/**
 * Extract a section under a heading at a given level.
 * Returns the content between the heading and the next heading of equal or higher level.
 */
function extractSection(text: string, heading: string, level: number): string {
  const prefix = "#".repeat(level);
  const pattern = new RegExp(
    `^${prefix} ${escapeRegExp(heading)}\\s*$`,
    "m",
  );
  const match = pattern.exec(text);
  if (!match) return "";

  const start = match.index + match[0].length;

  // Find next heading at same or higher level
  const nextHeadingPattern = new RegExp(`^#{1,${level}} `, "m");
  const rest = text.slice(start);
  const nextMatch = nextHeadingPattern.exec(rest);

  return nextMatch ? rest.slice(0, nextMatch.index) : rest;
}

/** Extract plain list items (strip leading "- "). */
function extractListItems(section: string): string[] {
  if (!section) return [];
  const items: string[] = [];
  for (const line of section.split("\n")) {
    const itemMatch = line.match(/^\s*-\s+(.+)/);
    if (itemMatch) {
      items.push(cleanListItem(itemMatch[1].trim()));
    }
  }
  return items;
}

/** Extract practices with optional wikilink references. */
function extractPractices(section: string): Practice[] {
  if (!section) return [];
  const practices: Practice[] = [];

  for (const line of section.split("\n")) {
    const itemMatch = line.match(/^\s*-\s+(.+)/);
    if (!itemMatch) continue;

    const raw = itemMatch[1].trim();

    // Check for wikilink: [[path|display]] or [[path]]
    const wikiMatch = raw.match(/\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/);
    if (wikiMatch) {
      const linkedNote = wikiMatch[1];
      // Use display text if present, otherwise use text after the wikilink
      const remaining = raw.replace(/\[\[.*?\]\]/, "").trim();
      const display = wikiMatch[2] || wikiMatch[1].split("/").pop() || "";
      const text = remaining ? display + " " + remaining : display;
      practices.push({ text, linkedNote });
    } else {
      practices.push({ text: raw, linkedNote: null });
    }
  }

  return practices;
}

/** Remove wikilinks from text, keeping display text. */
function cleanListItem(text: string): string {
  return text.replace(/\[\[([^\]|]*?)(?:\|([^\]]*?))?\]\]/g, (_m, path, display) => {
    return display || path.split("/").pop() || path;
  });
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
