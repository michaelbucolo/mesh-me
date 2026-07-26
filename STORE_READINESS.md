# mesh.me — Distribution & Store Readiness

An honest map of where mesh.me runs today, what makes it approvable, and
exactly what remains for native store distribution.

## Where mesh.me runs today (shipped, in this repo)

- **Any browser, any OS** — responsive web app covering phone, tablet,
  foldable, laptop, and desktop form factors.
- **Installable everywhere (PWA)** — web app manifest (`src/app/manifest.ts`)
  plus a conservative service worker (`public/sw.js`): home-screen install on
  iOS and Android, dock/taskbar install on macOS, Windows, Linux, and ChromeOS,
  with an offline fallback shell (`/offline`). The service worker never caches
  `/api` — nothing personal touches CacheStorage.
- **Watch-scale screens** — `/watch` is a glanceable one-column experience
  tuned for tiny WebKit viewports (Apple Watch included): unread activity,
  latest conversations, 44px tap targets, zero motion.

## Why review teams can approve it (already true in-product)

| Requirement (Apple 1.2 / Google UGC policies) | Status |
| --- | --- |
| Report user-generated content | Shipped — report action on posts, `Report` model, admin resolution queue |
| Block abusive users | Shipped — `Block` model enforced across feeds, comments, presence |
| In-app account deletion | Shipped — settings → delete account (verified live in QA) |
| Privacy policy + terms reachable in-app | Shipped — `/privacy`, `/terms` |
| Age-gated sensitive content | Shipped — NSFW off by default, adult verification flow before opt-in |
| No ads, no tracking, no data sale | True by design — MeshPro is the only revenue |
| Sign in with Apple requirement | Not triggered — mesh.me uses only first-party accounts (no third-party login buttons) |
| Payments | Stripe for MeshPro on the web. **Native iOS builds must use App Store billing (or qualify for the external-link entitlement) — see below** |

## What native distribution still requires (outside this repo)

These need accounts, certificates, and build machines that a web repo cannot
provide — listed so nobody mistakes the web work for the whole journey:

1. **iOS / Android wrappers** — wrap the site with Capacitor (or keep pure
   PWA on Android, where Play accepts TWAs). Requires Xcode + Apple
   Developer Program and Play Console accounts, app signing, and store
   listings.
2. **App Store billing** — Apple requires in-app purchase (StoreKit) for
   digital subscriptions inside the iOS binary; the Stripe checkout must be
   swapped or the app must qualify for the external-purchase entitlement in
   supported regions.
3. **A true watchOS app** — the `/watch` web experience covers watch browsers;
   a first-class Apple Watch app (complications, notifications) is a small
   SwiftUI companion that talks to the same APIs.
4. **Push notifications on iOS** — web push works on installed PWAs
   (iOS 16.4+); a native wrapper would move to APNs.

Nothing in the product itself blocks approval: moderation, deletion,
privacy, and payments policies are the review gates, and each is addressed
above.
