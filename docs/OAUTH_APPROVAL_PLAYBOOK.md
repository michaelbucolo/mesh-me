# OAuth & API Approval Playbook

This is the step-by-step guide to getting Mesh.me approved for **production**
OAuth access on every connected platform. It is generated from the live config
in `src/lib/oauth.ts`, so the scopes and callback URLs below are exactly what the
app sends.

> **What this doc can and can't do.** Approval on every platform below is a
> human review run by the provider. It requires signing into each developer
> console, submitting forms, and (on the heavier platforms) business/identity
> verification plus a screencast — none of which can be automated. This doc
> pre-answers every field the reviewers ask for so the console work is
> mechanical.

## Shared facts (fill these into every console)

| Field | Value |
| --- | --- |
| App name | Mesh.me |
| Production URL | `https://www.meshs.me` |
| Callback / redirect URI pattern | `https://www.meshs.me/api/auth/{platform}/callback` |
| Privacy policy | `https://www.meshs.me/privacy` |
| Terms of service | `https://www.meshs.me/terms` |
| Trust / security page | `https://www.meshs.me/trust` |
| Support email | `security@meshs.me` |
| Data deletion request URL (Meta) | `https://www.meshs.me/api/auth/meta/deletion` |
| Deauthorize callback URL (Meta) | `https://www.meshs.me/api/auth/meta/deauthorize` |

Set the exact per-platform redirect URI by substituting the platform id, e.g.
GitHub → `https://www.meshs.me/api/auth/github/callback`.

Before submitting anywhere: verify domain ownership of `meshs.me` where the
console offers it, and confirm `NEXT_PUBLIC_APP_URL=https://www.meshs.me` is set
in the production environment so generated callback URLs match what you register.

## Account creation

Sign in with the Google account (`business@michaelbucolo.com`) via "Continue
with Google" wherever the provider supports it. Where it doesn't (Apple,
sometimes Reddit/TikTok), register with the same business email. **Do not paste
account passwords into chat, issues, or commits** — use the provider's own login
screen or a password manager.

---

## Review-burden tiers

### Tier 1 — Heavy review (start these first; longest turnaround)

#### Google (YouTube)
- **Console:** Google Cloud Console → APIs & Services → OAuth consent screen + Credentials.
- **Redirect URI:** `https://www.meshs.me/api/auth/youtube/callback`
- **Scopes requested:** `youtube.readonly`, `youtube.force-ssl`
- **Why it's heavy:** `youtube.force-ssl` is a **sensitive scope**. Google
  requires OAuth verification: verified domain, app homepage, privacy policy, a
  demo video of the consent flow, and a written scope justification. Apps with
  restricted scopes may also need an annual third-party security assessment (CASA).
- **Do:** Publish the consent screen (not "Testing"), add `meshs.me` as an
  authorized domain, list both scopes with justifications, submit the demo video.
- **Justification text:** "Mesh.me lets a user connect their own YouTube channel
  to display and manage their own content within a unified profile. Read access
  shows the channel; force-ssl is required to manage the user's own uploads/edits
  they explicitly initiate."

#### Meta — Facebook
- **Console:** Meta for Developers → your app → App Review + Settings.
- **Redirect URI:** `https://www.meshs.me/api/auth/facebook/callback`
- **Scopes:** `public_profile`, `email`
- **Why it's heavy:** Requires **Business Verification** and App Review even for
  basic scopes in production. Data Deletion + Deauthorize callbacks are mandatory.
- **Do:** Set the **Data Deletion Request URL** and **Deauthorize Callback URL**
  from the shared-facts table (both are now implemented — see
  `src/app/api/auth/meta/`). Complete Business Verification. Submit `email` for review.

#### Meta — Instagram
- **Console:** Same Meta app (or a dedicated one) → Instagram API setup.
- **Redirect URI:** `https://www.meshs.me/api/auth/instagram/callback`
- **Scopes:** `instagram_business_basic`
- **Notes:** Requires an Instagram **professional (business/creator)** account
  for testing. Same Business Verification + data-deletion callback as Facebook.
  Env: `INSTAGRAM_APP_ID` / `INSTAGRAM_APP_SECRET`.

#### Meta — Threads
- **Console:** Meta for Developers → Threads use case.
- **Redirect URI:** `https://www.meshs.me/api/auth/threads/callback`
- **Scopes:** `threads_basic`, `threads_content_publish`, `threads_manage_insights`, `threads_read_replies`
- **Why it's heavy:** `threads_content_publish` and `threads_manage_insights`
  need explicit App Review with a screencast showing the publish/insights flow.
- **Notes:** Threads reuses the Facebook app credentials via env aliases
  (`THREADS_CLIENT_ID`→`FACEBOOK_APP_ID`). Same data-deletion/deauthorize callbacks apply.

#### X / Twitter
- **Console:** X Developer Portal → Project & App → User authentication settings.
- **Redirect URI:** `https://www.meshs.me/api/auth/twitter/callback`
- **Scopes:** `tweet.read`, `tweet.write`, `users.read`, `like.read`, `like.write`, `follows.read`, `follows.write`, `offline.access`
- **Notes:** Enable OAuth 2.0, type = Web App, PKCE (already sent by the app).
  Write scopes require describing the use case; a paid tier (Basic/Pro) is needed
  for meaningful write volume. `offline.access` gives refresh tokens.

#### TikTok
- **Console:** TikTok for Developers → Manage apps → Login Kit + scopes.
- **Redirect URI:** `https://www.meshs.me/api/auth/tiktok/callback`
- **Scopes:** `user.info.basic`
- **Notes:** App must be submitted for **production**; sandbox only works for
  added test users. Uses `client_key` (not `client_id`) — already handled.

### Tier 2 — Light review / production toggle

Most of these work immediately in development mode and only need a production or
quota toggle, plus the standard privacy/redirect fields.

| Platform | Redirect URI (`…/api/auth/{p}/callback`) | Scopes | Notes |
| --- | --- | --- | --- |
| GitHub | `…/github/callback` | `read:user`, `user:email`, `public_repo`, `user:follow` | OAuth App; no formal review. |
| Discord | `…/discord/callback` | `identify`, `email`, `guilds` | Add redirect in OAuth2 settings. |
| Spotify | `…/spotify/callback` | `user-read-private`, `user-read-email`, `playlist-modify-public/private`, `user-follow-modify` | Request **Extended Quota Mode** to leave dev mode (25-user cap). |
| Twitch | `…/twitch/callback` | `user:read:email`, `user:read:follows`, `moderator:read:followers` | Register redirect; no heavy review. |
| Reddit | `…/reddit/callback` | `identity`, `read`, `vote`, `submit`, `edit`, `subscribe` | "web app" type; set a descriptive User-Agent (app already sends `mesh.me/1.0`). |
| LinkedIn | `…/linkedin/callback` | `openid`, `profile`, `email` | Request "Sign In with LinkedIn using OpenID Connect" product. |
| Pinterest | `…/pinterest/callback` | `user_accounts:read` | Requires app review to leave trial; scope is read-only. |
| Snapchat | `…/snapchat/callback` | display_name, bitmoji.avatar | Snap Kit review for production; PKCE already sent. |
| Patreon | `…/patreon/callback` | `identity`, `identity[email]`, `campaigns.posts` | Register client; no heavy review. |
| SoundCloud | `…/soundcloud/callback` | (none) | App registration currently gated by SoundCloud; may require waitlist. |
| Dribbble | `…/dribbble/callback` | `public` | Register app; no heavy review. |

### Manual platforms (no OAuth — nothing to approve)

These use manual username entry because there's no usable OAuth API. No developer
account or approval needed: Bluesky, Apple Music, Mastodon, Substack, Medium,
Dev.to, Behance, WhatsApp, Telegram, Signal, Line, Kakao, Viber, WeChat,
Messenger, Tumblr.

---

## Submission order (recommended)

1. **Tier 1 first** — Google, Meta (FB/IG/Threads), X, TikTok. These take days to
   weeks and gate the most valuable integrations.
2. Complete **Meta Business Verification** early; it blocks all three Meta products.
3. **Tier 2** — do these in a single sitting; most approve instantly or within a day.
4. Track each submission's status and re-supply anything reviewers request.

## Pre-submission checklist (all done in-repo)

- [x] Privacy policy, terms, and trust pages live.
- [x] Callback URLs consistent and HTTPS on the production domain.
- [x] Meta **Data Deletion Request** callback implemented (`/api/auth/meta/deletion`).
- [x] Meta **Deauthorize** callback implemented (`/api/auth/meta/deauthorize`).
- [x] State/CSRF protection and PKCE on providers that require it.
- [x] Token revocation on disconnect.
- [ ] `NEXT_PUBLIC_APP_URL=https://www.meshs.me` set in production env.
- [ ] Domain `meshs.me` verified in each console that offers it.
- [ ] Per-platform client id/secret populated in production env (see `.env.example`).
