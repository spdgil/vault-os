import { describe, it, expect } from "vitest";
import { parseLifeSystem } from "./life-system-parser";

const SAMPLE_LIFE_SYSTEM = `---
status: active
tags:
- identity
- domains
- system
title: Life System
type: reference
---

The full connected network.

---

## Identity

**I AM A CHILD OF GOD REALISED IN LOVING RELATIONSHIP**

See [[vision]] for the full vision document.

---

## Theosis

*The inward journey. Personal formation, spiritual practice, health, development.*

### Life goals

- To daily meet my God within my being
- To keep a beginner's mind

### Epoch goals

- Understand my core childhood trauma (recovery)
- Have a strong understanding of the Bible

### Areas of responsibility

- Spiritual practices
- Biblical study
- Sleep

### Practices

- [[areas/theosis/practice-prayer|Prayer]]
- [[areas/theosis/practice-daily-exercise|Daily exercise]]
- Sleep 7+ hours a night
- Read fiction in the evenings

---

## Team Gill

*Family life as a unit. Parenting, routines, adventures.*

### Life goals

- To know my kids and support them
- To have silly days and go on grand romantic adventures

### Epoch goals

- Deepen the marriage with Nicki

### Areas of responsibility

- Nicki (partnership, adventure, romance)
- Amie, Lulu, Freddie (individual development and daily life)

### Practices

- [[areas/team-gill/practice-daily-prayer|Daily prayer]]
- Have at least one interest with each kid
`;

describe("parseLifeSystem", () => {
  const result = parseLifeSystem(SAMPLE_LIFE_SYSTEM);

  it("extracts the identity statement", () => {
    expect(result.identity).toBe(
      "I AM A CHILD OF GOD REALISED IN LOVING RELATIONSHIP",
    );
  });

  it("extracts domain names", () => {
    const names = result.domains.map((d) => d.name);
    expect(names).toEqual(["Theosis", "Team Gill"]);
  });

  it("extracts domain descriptions", () => {
    expect(result.domains[0].description).toBe(
      "The inward journey. Personal formation, spiritual practice, health, development.",
    );
    expect(result.domains[1].description).toBe(
      "Family life as a unit. Parenting, routines, adventures.",
    );
  });

  it("extracts life goals", () => {
    expect(result.domains[0].lifeGoals).toEqual([
      "To daily meet my God within my being",
      "To keep a beginner's mind",
    ]);
  });

  it("extracts epoch goals", () => {
    expect(result.domains[0].epochGoals).toEqual([
      "Understand my core childhood trauma (recovery)",
      "Have a strong understanding of the Bible",
    ]);
    expect(result.domains[1].epochGoals).toEqual([
      "Deepen the marriage with Nicki",
    ]);
  });

  it("extracts areas of responsibility", () => {
    expect(result.domains[0].areas).toEqual([
      "Spiritual practices",
      "Biblical study",
      "Sleep",
    ]);
  });

  it("extracts practices with linked notes", () => {
    const practices = result.domains[0].practices;
    expect(practices[0]).toEqual({
      text: "Prayer",
      linkedNote: "areas/theosis/practice-prayer",
    });
    expect(practices[1]).toEqual({
      text: "Daily exercise",
      linkedNote: "areas/theosis/practice-daily-exercise",
    });
  });

  it("extracts practices without links", () => {
    const practices = result.domains[0].practices;
    expect(practices[2]).toEqual({
      text: "Sleep 7+ hours a night",
      linkedNote: null,
    });
    expect(practices[3]).toEqual({
      text: "Read fiction in the evenings",
      linkedNote: null,
    });
  });

  it("handles practices from second domain", () => {
    const practices = result.domains[1].practices;
    expect(practices[0]).toEqual({
      text: "Daily prayer",
      linkedNote: "areas/team-gill/practice-daily-prayer",
    });
    expect(practices[1]).toEqual({
      text: "Have at least one interest with each kid",
      linkedNote: null,
    });
  });
});

describe("parseLifeSystem with real content", () => {
  it("handles empty input gracefully", () => {
    const result = parseLifeSystem("");
    expect(result.identity).toBe("");
    expect(result.domains).toEqual([]);
  });

  it("handles file with only frontmatter", () => {
    const result = parseLifeSystem("---\ntype: reference\n---\n");
    expect(result.identity).toBe("");
    expect(result.domains).toEqual([]);
  });
});
