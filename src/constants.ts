export const VIEW_TYPE_VAULT_OS = "vault-os-view";
export const ICON_VAULT_OS = "layout-dashboard";

export const VIEW_TYPE_DAY = "vault-os-day";
export const ICON_DAY = "calendar-days";

export const VIEW_TYPE_KANBAN = "vault-os-kanban";
export const ICON_KANBAN = "kanban";

/** Path patterns for vault data sources */
export const VAULT_PATHS = {
  dailyNotes: "_inbox/notes/daily",
  yearlyPlans: "_inbox/plans/yearly",
  tasks: "tasks",
  essays: "areas/*/essays",
  projects: "projects/*",
  practices: "areas/*/practice-*.md",
  reviews: "reviews",
  lifeSystem: "life-system.md",
  vision: "vision.md",
  people: "people",
  insights: "_inbox/insights",
  templates: "templates",
} as const;

/** Frontmatter type values used across vault notes */
export const NOTE_TYPES = {
  journal: "journal",
  yearlyPlan: "yearly-plan",
  task: "task",
  writing: "writing",
  codeProject: "code-project",
  practice: "practice",
  review: "review",
  reference: "reference",
  person: "person",
  insight: "insight",
} as const;
