// Facebook-style "About" fields, with per-field privacy. Shared between the
// read path (queries.ts gates each field for the viewer) and the write path
// (actions.ts validates + persists), so the two can never drift apart.

export const ABOUT_FIELDS = [
  "aboutMe",
  "workplace",
  "jobTitle",
  "school",
  "hometown",
  "currentCity",
  "relationshipStatus",
  "birthday",
  "gender",
  "pronouns",
  "publicEmail",
  "publicPhone",
] as const;

export type AboutField = (typeof ABOUT_FIELDS)[number];

export type AboutPrivacyLevel = "public" | "friends" | "personal";
export const ABOUT_PRIVACY_LEVELS: readonly AboutPrivacyLevel[] = ["public", "friends", "personal"];

// Human-facing label + a longer example placeholder for each field.
export const ABOUT_FIELD_META: Record<AboutField, { label: string; group: AboutGroup; placeholder: string; multiline?: boolean }> = {
  aboutMe: { label: "About you", group: "intro", placeholder: "A short bio in your own words", multiline: true },
  workplace: { label: "Workplace", group: "work", placeholder: "Where you work" },
  jobTitle: { label: "Job title", group: "work", placeholder: "What you do" },
  school: { label: "School", group: "work", placeholder: "Where you studied" },
  hometown: { label: "Hometown", group: "places", placeholder: "Where you're from" },
  currentCity: { label: "Current city", group: "places", placeholder: "Where you live now" },
  relationshipStatus: { label: "Relationship", group: "basics", placeholder: "e.g. Single, Married" },
  birthday: { label: "Birthday", group: "basics", placeholder: "e.g. April 20" },
  gender: { label: "Gender", group: "basics", placeholder: "e.g. Woman, Man, Nonbinary" },
  pronouns: { label: "Pronouns", group: "basics", placeholder: "e.g. she/her, they/them" },
  publicEmail: { label: "Contact email", group: "contact", placeholder: "A public email address" },
  publicPhone: { label: "Contact phone", group: "contact", placeholder: "A public phone number" },
};

type AboutGroup = "intro" | "work" | "places" | "basics" | "contact";
export const ABOUT_GROUPS: { key: AboutGroup; label: string }[] = [
  { key: "intro", label: "Intro" },
  { key: "work", label: "Work & Education" },
  { key: "places", label: "Places" },
  { key: "basics", label: "Basic info" },
  { key: "contact", label: "Contact" },
];

// Per-field length caps. aboutMe is a paragraph; everything else is a line.
export function aboutFieldMaxLen(field: AboutField): number {
  return field === "aboutMe" ? 1000 : 200;
}

export function isAboutPrivacyLevel(value: unknown): value is AboutPrivacyLevel {
  return value === "public" || value === "friends" || value === "personal";
}

/** Parse the stored fieldPrivacy JSON into a clean map, ignoring junk. */
export function parseFieldPrivacy(raw: string | null | undefined): Partial<Record<AboutField, AboutPrivacyLevel>> {
  const out: Partial<Record<AboutField, AboutPrivacyLevel>> = {};
  if (!raw) return out;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return out;
    for (const field of ABOUT_FIELDS) {
      const level = (parsed as Record<string, unknown>)[field];
      if (isAboutPrivacyLevel(level)) out[field] = level;
    }
  } catch {
    // Malformed JSON → treat as no explicit privacy (fail closed downstream).
  }
  return out;
}

/**
 * The read gate. Given a filled field's per-field privacy level and the
 * viewer's relationship, decide whether the viewer may see it. Fails CLOSED:
 * a field with no explicit level is visible only to its owner.
 */
export function canSeeAboutField(
  level: AboutPrivacyLevel | undefined,
  ctx: { isOwner: boolean; isFriend: boolean },
): boolean {
  if (ctx.isOwner) return true;
  if (level === "public") return true;
  if (level === "friends") return ctx.isFriend;
  return false; // "personal" or unset → owner only
}
