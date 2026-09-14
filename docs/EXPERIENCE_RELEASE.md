# Mesh.me experience release

This release improves the existing Mesh.me application at https://www.meshs.me.
It retains the connected GitHub repository, Vercel project, user accounts and
social data.

## Changes

- Public entry offers browsing before signup and the same configured identity
  providers as the dedicated login page. Guest navigation connects Explore and
  Flow. Explore has a clear heading and a direct route into Flow.
- Home, Mesh and community posting use one composer with media previews,
  audience controls, visible errors, submission locking, keyboard submission,
  and drafts scoped to the current account and community in session storage.
  Drafts expire after seven days; text and links persist within the tab, files
  must be reattached. Mesh's composer uses the existing accessible modal.
- Uploads accept up to four attachments and 4 MiB combined, with matching
  client and server checks. Signatures determine stored media types. Files live
  separately from feed metadata and are delivered through an authenticated
  audience check. Byte ranges support seeking; private responses are not cached.
  Existing inline video uploads remain playable under the media CSP.
- Community membership no longer overrides Friends or Only me. The explicit
  `community` audience means members only and stays restricted if the community
  becomes public. The same rules cover feed, permalink, saved posts,
  interactions and uploaded file access. Blocks and suspended authors are
  excluded. Private-community content cannot be cross-posted as Public.
- Feed filter changes cancel stale pagination requests; failed filters can be
  retried. Search clears stale results, supports retry, follows URL changes and
  limits query length. Search copy describes the sources actually searched.
- Flow's sideways lane scores shared topics and tags. Author and format only
  break ties. It excludes unrelated posts, duplicate items, the anchor and long
  videos. This is a bounded text similarity heuristic, not a claim of semantic
  understanding or a new third-party AI integration.
- Next.js, React, Prisma and their lockfile are updated. Scoped Prisma CLI
  overrides resolve remaining transitive advisories. CI audits dependencies and
  exercises the production HTTP implementation against an isolated database.

## Database rollout

`PostMediaFile` is additive. Its foreign key cascades from PostMedia, so deleting
a post removes the uploaded bytes. Ordinary media queries exclude file data.
Both Prisma migrations and the production bootstrap SQL contain the table.

Historically, `private` on a community post meant all members. A one-time
normalization changes that value to `community`, preserving the old member
audience. New `private` posts mean Only me. The production bootstrap applies the
normalization and marker in one transaction; rerunning it cannot reinterpret new
Only me posts. The equivalent Prisma migration supports migration-managed
databases. Local bootstrap remains structural only.

## Verification commands

```sh
npm ci
npm audit --audit-level=high
npm run build
npm run check
npm run experience:http
```

The experience test provisions its own temporary SQLite database. It checks
the audience matrix using real queries, media access with separate sessions,
byte ranges and HEAD responses, deletion cascades, draft parsing, query bounds,
and related-post selection. Its HTTP mode starts the production build on a
loopback port and never contacts a production database.

## Operational limits

- Large video uploads require direct object-storage uploads and a processing
  pipeline. This release supports small uploads and larger externally hosted
  video links; it does not provision a paid storage service.
- Connected-platform publishing, email delivery, payments and AI features need
  the corresponding production provider credentials and granted scopes.
  Public browsing or an isolated test database cannot verify those accounts.
- Live signed-in visual review requires an authorized user session. Local HTTP
  tests do not prove every animation, device layout or third-party integration.
- The production hostname currently connected to Vercel is `www.meshs.me`.
  This release does not acquire or change ownership of `mesh.me`.

Reference: [Vercel function limits](https://vercel.com/docs/functions/limitations)
and [Next.js server action limits](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions).
