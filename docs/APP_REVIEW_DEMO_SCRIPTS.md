# App Review Demo Scripts

Google and Meta require a screen recording that shows the OAuth consent flow and
how each requested scope is used inside the product. Reviewers reject vague or
mismatched videos, so record exactly what's scripted below. Record at 1080p, in
English, with the browser URL bar visible so the reviewer can see the real
`meshs.me` domain and the provider consent screen.

General setup for every recording:
- Use the production site `https://www.meshs.me` (not localhost or a preview URL).
- Start signed out. Show sign-up / sign-in first so the reviewer sees the app is real.
- When the provider consent screen appears, pause ~2s so the granted scopes are legible.
- After connecting, demonstrate the feature that consumes each scope.

---

## Google / YouTube

**Scopes under review:** `youtube.readonly`, `youtube.force-ssl`

**Script:**
1. Sign in to Mesh.me. Navigate to **Connected accounts**.
2. Click **Connect** on YouTube. On Google's consent screen, read the requested
   permissions aloud and click **Allow**.
3. Back in Mesh.me, show the connected YouTube channel appearing on the profile
   (this uses `youtube.readonly` to display the user's own channel).
4. Demonstrate a user-initiated action that manages the user's own content
   (the action `youtube.force-ssl` enables). Narrate: "This action is initiated
   by the user and only affects the user's own YouTube content."
5. Go to **Connected accounts**, disconnect YouTube, and show it is removed.
   Narrate that disconnecting revokes the Google token.

**Justification to paste in the console:** "Mesh.me lets a user connect their own
YouTube channel to view and manage their own content within a single unified
profile. `youtube.readonly` displays the user's channel; `youtube.force-ssl` is
required for user-initiated management of the user's own uploads. Data is never
sold, used for ads, or shared, per our Limited Use commitment at
https://www.meshs.me/privacy#platform-api-compliance."

---

## Meta — Facebook

**Permissions under review:** `email` (plus `public_profile`)

**Script:**
1. Sign in to Mesh.me → **Connected accounts** → **Connect** Facebook.
2. On Facebook's dialog, show the requested permissions and click **Continue**.
3. Show the connected Facebook account on the profile.
4. Demonstrate the deletion path: open **Settings → Apps** in Facebook, remove
   Mesh.me, and narrate that this triggers our Deauthorize + Data Deletion
   callbacks at `https://www.meshs.me/api/auth/meta/deauthorize` and
   `.../api/auth/meta/deletion`.

## Meta — Instagram

**Permissions under review:** `instagram_business_basic`

**Script:**
1. Ensure the test Instagram account is a professional (business/creator) account.
2. Mesh.me → **Connected accounts** → **Connect** Instagram → authorize.
3. Show the connected Instagram username surfaced on the profile.
4. Disconnect from **Connected accounts** and show removal.

## Meta — Threads

**Permissions under review:** `threads_basic`, `threads_content_publish`,
`threads_manage_insights`, `threads_read_replies`

**Script:**
1. Mesh.me → **Connected accounts** → **Connect** Threads → authorize, showing
   each scope on the consent screen.
2. `threads_content_publish`: compose and publish a post to Threads from Mesh.me.
3. `threads_read_replies`: open the published post and show replies rendered in Mesh.me.
4. `threads_manage_insights`: open the post's insights/analytics view.
5. Disconnect Threads and show removal.

---

## X / Twitter

**Scopes under review:** write + follow scopes, `offline.access`

**Script:**
1. Mesh.me → **Connected accounts** → **Connect** X → authorize (show scopes).
2. `tweet.write`: post from Mesh.me and show it on X.
3. `follows.write`: follow an account from Mesh.me.
4. `like.write`: like a post from Mesh.me.
5. Narrate that `offline.access` keeps the connection alive via refresh tokens.

---

## TikTok

**Scopes under review:** `user.info.basic`

**Script:**
1. Mesh.me → **Connected accounts** → **Connect** TikTok → authorize.
2. Show the TikTok display name/username surfaced on the profile.
3. Disconnect and show removal.

---

## Recording checklist

- [ ] Real production domain visible in the URL bar throughout.
- [ ] Provider consent screen shown with scopes legible.
- [ ] Each requested scope demonstrated by a concrete in-product action.
- [ ] Disconnect / data-deletion path shown at the end.
- [ ] No test credentials, tokens, or secrets visible on screen.
