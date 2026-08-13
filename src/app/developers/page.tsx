import type { Metadata } from "next";
import Link from "next/link";
import { PAT_RESOURCES } from "@/lib/me-api";

export const metadata: Metadata = {
  title: "Developers",
  description: "The mesh.me personal data API — everything mesh.me knows that's yours, readable by you, with a token.",
};

// THE API'S FRONT DOOR — generated from the same PAT_RESOURCES constant the
// routes read, so this page cannot describe an endpoint that doesn't exist
// or omit one that does (pat-check pins the import). The register is the
// house voice: plain sentences, honest about what is NOT here.

const EXCLUSIONS: Array<{ what: string; why: string }> = [
  { what: "Messages and MeChat", why: "A conversation has a counterparty — their half is not yours to stream through a standing credential." },
  { what: "Notifications", why: "The rows name the people who acted — other people's identities." },
  { what: "Follower and following lists", why: "Counts are in your profile; the edges are other people's identities. The one-shot data export remains the place for them, with you present." },
  { what: "Flow watch history", why: "The most intimate table in the product. Not exposed here, and flagged for its own careful treatment." },
  { what: "Other people's content", why: "Feed items, public posts, anything authored by someone else." },
  { what: "Blocks, mutes, and reports", why: "Safety lists stay off every wire." },
  { what: "Credentials and security records", why: "Platform tokens, sessions, password data, verification records — no token reads the keys to anything, including itself." },
  { what: "Anything billing", why: "Stripe state never serializes toward a token." },
  { what: "Writes of any kind", why: "The API is read-only. Posting, settings, and money always require you, present, signed in." },
];

export default function DevelopersPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-semibold text-[var(--text-primary,#f2f4f8)]">The personal data API</h1>
      <p className="mt-2 text-base leading-relaxed text-[var(--text-secondary,#b6c2d2)]">
        Everything mesh.me knows that&apos;s yours, readable by you, with a token. Read-only. Your account only.
        The data API is the same for everyone. Your data doesn&apos;t have a paywall.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-[var(--text-primary,#f2f4f8)]">Quickstart</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-secondary,#b6c2d2)]">
        Mint a token in{" "}
        <Link href="/privacy-controls" className="font-semibold text-[var(--accent-text,#7cb1ff)] underline underline-offset-4">
          Privacy Controls
        </Link>
        , then:
      </p>
      <pre className="mt-2 overflow-x-auto rounded-xl border border-[var(--border-primary,#2d3848)] bg-[var(--bg-elevated,#151c26)] p-4 text-xs leading-relaxed text-[var(--text-primary,#f2f4f8)]">
{`curl -H "Authorization: Bearer mesh_pat_..." \\
  https://meshs.me/api/me/v1/posts?limit=50`}
      </pre>
      <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary,#b6c2d2)]">
        Pages come back as {"{data, nextCursor}"} — pass the cursor back to continue. Tokens are for scripts
        and servers, not script tags: the API sends no CORS headers on purpose, because a token in browser
        JavaScript is a leak in progress.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-[var(--text-primary,#f2f4f8)]">The token, honestly</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-secondary,#b6c2d2)]">
        A token looks like <code className="text-xs">mesh_pat_&lt;fingerprint&gt;.&lt;secret&gt;</code> and matches{" "}
        <code className="text-xs">{"^mesh_pat_[A-Za-z0-9_-]{12}\\.[A-Za-z0-9_-]{43}$"}</code> — grep your repos
        and logs for it. We keep a fingerprint, not the token: it is hashed at creation and nobody at mesh.me
        can read it back. Every token expires (a year at most), every token is revocable instantly, and a
        revoked token is deleted — not flagged, deleted. If one leaks: it could only ever read, only your
        account, only its scopes, and it dies the moment you revoke it.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-[var(--text-primary,#f2f4f8)]">Resources</h2>
      <ul className="mt-2 space-y-2">
        {PAT_RESOURCES.map((resource) => (
          <li key={resource.path} className="rounded-xl border border-[var(--border-primary,#2d3848)] bg-[var(--bg-elevated,#151c26)] px-4 py-3">
            <code className="text-sm font-semibold text-[var(--text-primary,#f2f4f8)]">GET {resource.path}</code>
            {resource.scope && <span className="ml-2 text-micro text-[var(--text-muted,#8b93a7)]">{resource.scope}</span>}
            <p className="mt-0.5 text-sm text-[var(--text-secondary,#b6c2d2)]">{resource.description}</p>
          </li>
        ))}
      </ul>

      <h2 className="mt-8 text-lg font-semibold text-[var(--text-primary,#f2f4f8)]">What is deliberately not here</h2>
      <ul className="mt-2 space-y-1.5">
        {EXCLUSIONS.map((exclusion) => (
          <li key={exclusion.what} className="text-sm leading-relaxed text-[var(--text-secondary,#b6c2d2)]">
            <span className="font-semibold text-[var(--text-primary,#f2f4f8)]">{exclusion.what}.</span>{" "}
            {exclusion.why}
          </li>
        ))}
      </ul>

      <h2 className="mt-8 text-lg font-semibold text-[var(--text-primary,#f2f4f8)]">Limits and answers</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-secondary,#b6c2d2)]">
        60 requests a minute and 600 an hour per token, 1,000 an hour per account — a full backfill fits in an
        hour, a daily sync in single digits. A 401 means the token doesn&apos;t work; we won&apos;t tell you whether a
        dead token was ever real — that&apos;s deliberate. A 403 names the missing scope. A 404 is the same for a
        thing that doesn&apos;t exist and a thing that isn&apos;t yours. v1 only ever gains fields, never loses or
        renames them; anything breaking would be a v2 beside it.
      </p>
    </main>
  );
}
