# App Review — Copy-Paste Answers

Ready-to-paste text for the verification and App Review forms on each platform.
These are written to match Mesh.me's actual behavior (connect your own accounts,
view and manage your own content in one place; no ads, no data sale). Edit only
if product behavior changes. Do not paste any secrets — these are public-facing
justifications only.

Reference URLs (used throughout):
- Home: `https://www.meshs.me`
- Privacy: `https://www.meshs.me/privacy`
- Limited Use section: `https://www.meshs.me/privacy#platform-api-compliance`
- Terms: `https://www.meshs.me/terms`
- Data deletion: `https://www.meshs.me/data-deletion`

---

## One-line product description (reuse anywhere)

> Mesh.me is a unified social hub where a person connects their own accounts
> across platforms and views, posts, and manages their own content from one
> profile. Access is per-user and per-scope; data is never sold or used for ads.

---

## Google — OAuth verification (YouTube scopes)

**App name:** Mesh.me
**Scopes:** `.../auth/youtube.readonly`, `.../auth/youtube.force-ssl`

**"How will the scopes be used?"**
> Mesh.me lets a signed-in user connect their own YouTube channel to a single
> unified profile. `youtube.readonly` is used to read and display the user's own
> channel details and content inside Mesh.me. `youtube.force-ssl` is used only
> to perform management actions the user explicitly initiates on their own
> YouTube content (such as edits to their own uploads) from within Mesh.me. We
> request the minimum scopes needed for these user-facing features.

**"Why do you need each of these scopes?"**
> `youtube.readonly`: display the user's own channel and videos in their Mesh.me
> profile and analytics views. `youtube.force-ssl`: carry out user-initiated
> management of the user's own content; the read-only scope alone cannot perform
> these write actions.

**Limited Use affirmation (paste when asked, or link the URL):**
> Mesh.me's use and transfer of information received from Google APIs adheres to
> the Google API Services User Data Policy, including the Limited Use
> requirements. See https://www.meshs.me/privacy#platform-api-compliance.

**Demo video:** follow `docs/APP_REVIEW_DEMO_SCRIPTS.md` → Google / YouTube.

---

## Meta — App Review

App domains: `meshs.me`. Privacy Policy URL: `https://www.meshs.me/privacy`.
User Data Deletion: **Data Deletion Request URL** =
`https://www.meshs.me/api/auth/meta/deletion`;
**Deauthorize Callback URL** = `https://www.meshs.me/api/auth/meta/deauthorize`.

### Facebook — `email`
**"Tell us how you're using this permission":**
> After a user connects their Facebook account, Mesh.me uses the email to match
> and link the connection to the user's existing Mesh.me account and to send
> essential account/security notifications. It is not used for advertising and
> is never sold.

### Instagram — `instagram_business_basic`
> Mesh.me displays the connected Instagram professional account's basic profile
> (username and account info) on the user's unified Mesh.me profile so they can
> see and manage their connected accounts in one place. Read-only; not used for
> ads or sold.

### Threads — content & insights scopes
**`threads_basic`:**
> Display the user's connected Threads profile within Mesh.me.

**`threads_content_publish`:**
> Let the user compose and publish posts to their own Threads account directly
> from Mesh.me's post composer.

**`threads_read_replies`:**
> Show replies to the user's own Threads posts inside Mesh.me so they can follow
> conversations from one place.

**`threads_manage_insights`:**
> Show the user analytics/insights for their own Threads posts within Mesh.me's
> analytics view.

### Data deletion note (paste in the review notes)
> Removing Mesh.me from a Facebook/Instagram/Threads account triggers our
> Deauthorize and Data Deletion callbacks, which delete the stored tokens and
> cached connected-account data for that platform identity. Users can also
> delete data anytime at https://www.meshs.me/data-deletion.

---

## X / Twitter — use-case description

**Scopes:** `tweet.read`, `tweet.write`, `users.read`, `like.read`, `like.write`,
`follows.read`, `follows.write`, `offline.access`

> Mesh.me is a unified social hub. After a user connects their own X account,
> they can read their timeline/profile, and — through explicit in-app actions —
> post, like, and follow on their own behalf from Mesh.me. `offline.access` is
> used to refresh the connection so the user does not have to re-authorize
> frequently. All actions are user-initiated on the user's own account; no
> automated bulk posting, no ads, no data sale.

---

## TikTok — app submission

**Scope:** `user.info.basic`

> Mesh.me displays the connected TikTok account's basic public profile
> (username, display name, avatar) on the user's unified Mesh.me profile so they
> can view and manage their connected accounts in one place. Read-only; not used
> for advertising or sold.

---

## Reusable data-handling answers (common form fields)

**Do you sell user data?** No. Mesh.me never sells user data; this is a stated,
permanent commitment in our privacy policy.

**Do you use the data for advertising?** No.

**How is data stored/secured?** OAuth tokens are encrypted at rest; passwords are
bcrypt-hashed; all transport is HTTPS; CSRF protection, rate limiting, and input
validation are applied across endpoints. See `https://www.meshs.me/privacy`.

**How can users delete their data?** In-product account deletion, per-platform
disconnect, or a request via `https://www.meshs.me/data-deletion`. Personal data
is deleted/anonymized within 30 days; backups purge within 90 days.

**Who has access to the data?** Only the user; essential subprocessors (Vercel
hosting, Stripe payments, transactional email) under DPAs; and law enforcement
only under valid legal process.
