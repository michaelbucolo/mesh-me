// THE ONE STATEMENT OF "what a profile's visibility amounts to".
//
// Deliberately dependency-free: both the Settings header pill and the Analytics
// privacy row are client components, and the module this rule belongs beside
// (privacy-policy.ts, next to canViewProfile) imports Prisma. Importing that
// into a client bundle pulls node:async_hooks and node:buffer into webpack and
// fails the build — so the RULE moves here and privacy-policy re-exports it.
// One definition, reachable from both sides.

/** Mirrors MeshVisibility in privacy-policy.ts. Inlined rather than imported
 *  so this module pulls in nothing — importing the type from a file that also
 *  imports Prisma is what broke the client build. */
type MeshVisibilityLike = "private" | "friends" | "public" | "partial";

/**
 * WHAT A PROFILE'S VISIBILITY ACTUALLY IS, for showing the user.
 *
 * canViewProfile below answers "may THIS viewer see it". The UI needs the other
 * question — "what does this profile's setting amount to" — and two screens
 * answered it by reading `User.isPublic` alone. That column is not the gate.
 * The gate is `isPublic !== false || visibility === "public"`, so a profile with
 * isPublic=false and mesh visibility "public" is world-readable and Settings
 * labelled it "Private profile".
 *
 * That state is one click away, not a corner case: /privacy-controls writes
 * User.isPublic and MeshPrivacy.meshVisibility through two independent actions,
 * neither touching the other column, and the schema default for isPublic is
 * false. Choosing "public" for the mesh alone produces it.
 *
 * Derived from the same expression canViewProfile uses, in the same file, so
 * the label cannot drift from the rule it describes.
 */
export function effectiveProfileVisibility(
  isPublic: boolean | null | undefined,
  visibility: MeshVisibilityLike | string | null | undefined,
): "public" | "friends" | "private" {
  if (isPublic !== false || visibility === "public") return "public";
  return visibility === "friends" ? "friends" : "private";
}

