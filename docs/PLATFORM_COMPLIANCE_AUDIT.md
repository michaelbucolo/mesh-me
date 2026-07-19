# Connected-Platform Compliance Audit

An audit of how Mesh.me's code actually behaves against the developer/API
policies of each connected platform. Scope: OAuth handling, token storage, data
use, caching/retention, and required callbacks.

> **What this is and isn't.** This is an engineering audit of code behavior
> against publicly known platform developer policies — not legal advice and not
> a guarantee of legal compliance, which only a qualified lawyer can assess.
> Platform policies also change; re-check each provider's current developer terms
> before submitting for review. Items marked **Action** need a human decision or
> console step.

## Overall posture: strong

Mesh.me already follows the practices most platform policies require:

- **User-authorized, per-scope access only.** OAuth scopes are requested
  explicitly and are the minimum per feature (`src/lib/oauth.ts`); no scraping or
  non-API access exists in the codebase.
- **Encrypted token storage.** Access/refresh tokens are encrypted at rest
  (`encryptSecret`, `src/lib/secret-store.ts`).
- **CSRF + PKCE.** OAuth uses a timing-safe `state` check, and PKCE is sent for
  providers that require it (Twitter/X, Snapchat, SoundCloud).
- **Revocation on disconnect.** Disconnecting deletes stored tokens and, where the
  provider supports it, calls the revoke endpoint (`revokeOAuthToken`).
- **Deletion honored.** Meta Data Deletion + Deauthorize callbacks are implemented
  (`/api/auth/meta/*`); a public `/data-deletion` page documents user options.
- **User-initiated actions only.** Cross-platform posts/likes/follows run through
  the signed-in user's own authorized connection — no automated bulk activity.

## Findings

### 1. Reddit User-Agent — FIXED ✅
Reddit's API Terms require a **unique, descriptive** User-Agent and aggressively
rate-limit generic ones. The code sent `mesh.me/1.0`. Now centralized into
`MESH_API_USER_AGENT` (`src/lib/oauth.ts`), defaulting to
`web:app.meshs.me:v1.0 (+https://www.meshs.me)` and overridable via env.
**Action:** set `MESH_API_USER_AGENT` to Reddit's preferred
`platform:appID:version (by /u/<your-reddit-username>)` once you have a Reddit
developer username — this maximizes Reddit rate limits and goodwill.

### 2. Cached platform content vs. source deletions — REVIEW ⚠️
Mesh.me caches synced platform content (`PlatformPost`, `PlatformComment`,
`PlatformMedia`, `PlatformFollower`). Several platforms — notably **X/Twitter**
and **Meta** — require that content deleted or made private at the source be
removed from your copy within a defined window, and cap how long/what you may
cache. There is no reconciliation job that removes cached items when the source
deletes them.
**Action (product):** add a periodic re-sync that drops cached items no longer
returned by the source, and cap cache lifetime (e.g. refresh at least every 24h
for X). Until then, keep cached datasets small and short-lived. Disconnect
already purges a platform's cached rows via cascade delete.

### 3. Scope breadth for write/follow permissions — OK, keep justified
Some providers are granted write scopes (GitHub `public_repo`/`user:follow`,
X write+follow, Spotify playlist/follow modify, Reddit `submit`/`vote`/`edit`).
These are legitimate for user-initiated cross-posting features but draw the most
review scrutiny. **Action:** ensure each is actually exercised by a shipped
feature; drop any you don't use before submitting for review (reviewers reject
unused elevated scopes). Justifications are pre-written in
`docs/APP_REVIEW_ANSWERS.md`.

### 4. Brand/attribution and "Sign in with" buttons — REVIEW
Google, Apple, Meta, and X have branding guidelines for their sign-in buttons and
rules for displaying their content/marks (correct logos, naming, no implication
of endorsement). **Action (design):** confirm the connect buttons and any content
attribution match each provider's current brand guidelines before launch.

### 5. Age-restricted content — handled, verify jurisdiction coverage
NSFW is off by default and gated behind third-party age verification at 18+
(`src/lib/content-safety.ts`, `/api/adult-verification/callback`); Mesh.me stores
only a pass/fail status, not ID documents. **Action (legal):** confirm the chosen
verifier satisfies each state's specific ID-verification law where you operate.

## Per-platform quick reference

| Platform | Key policy touchpoints | Mesh.me status |
| --- | --- | --- |
| Google/YouTube | Limited Use, verification, minimal scopes | Limited Use disclosed; scopes minimal |
| Meta (FB/IG/Threads) | App Review, Business Verification, data-deletion + deauthorize callbacks | Callbacks live; verification is a console step |
| X/Twitter | Tiered access, honor source deletions, display rules | PKCE + revoke OK; **see Finding 2** |
| Reddit | Unique User-Agent, OAuth duration, data API terms | **Fixed (Finding 1)** |
| TikTok | Production submission, display-name usage | Minimal scope; console submission pending |
| GitHub | User-Agent required, scope minimization | UA fixed; scopes per-feature |
| Discord/Twitch/Spotify/LinkedIn/Pinterest/Snapchat/Patreon/SoundCloud/Dribbble | Standard OAuth, provider ToS, quota/prod toggle | Standard-compliant; some need a prod toggle |

## Bottom line

The code-level compliance posture is solid, and the one clear violation (Reddit's
generic User-Agent) is fixed in this change. The remaining items are either
console/verification steps only you can complete (submissions, business
verification, brand review) or a product decision (Finding 2: reconcile cached
content with source deletions), which I can implement on request. None of the
open items is a hidden or egregious ToS breach — they are the normal
"tighten before launch" list.
