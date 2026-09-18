# Mesh.me public release checklist

Updated 18 September 2026. This document separates verified code behavior from production configuration. A green build is not a public-launch certificate.

## Production requirements

| Requirement | Evidence and next action | Status |
| --- | --- | --- |
| Canonical domain | The owner confirmed `meshs.me` as the launch domain; Vercel serves `meshs.me` and `www.meshs.me`. Mesh.me remains the product name. The separately owned `mesh.me` domain is not required for launch. | Verified |
| Connected accounts | Production rejects the existing encryption key as unusable. The authenticated production credential audit confirms that encrypted and other nonempty credential payloads already exist. Recover the matching key or plan an explicit migration/reconnection with recovery coverage; do not replace the key blindly. The audit returns counts only and does not establish decryptability. | Blocked |
| Real payments | The connected Stripe account is in test mode and had no active prices or webhook endpoints. Vercel has price IDs and static payment links but lacks the Stripe server key and webhook signing secret. Static links cannot safely establish account ownership, so this release leaves purchasing unavailable until matching live keys, prices and a webhook are configured. A completed live payment, entitlement, refund and cancellation still need verification. | Unverified |
| Gift payments | Production reports zero configured gift prices. Configure one-time prices matching the displayed amounts, or keep purchase controls unavailable. | Blocked |
| Recovery and verification email | Send and redeem a real recovery/verification email; establish ownership of the configured sender domain. | Unverified |
| Owner administration | The existing owner account has administrator access. The protected console, account-menu link and audit entry were verified. The temporary bootstrap variable was removed after setup. | Verified |
| Fixture cleanup | One positively identified fixture and its test comment were deleted through the administrator console, with an audit entry. The remaining protected fixture was suspended, with an audit entry, while its relationships are reviewed for permanent cleanup. | Partial |
| Moderation | Verify reports reach the administrative queue, assign an operator, and exercise suspension and appeals handling. Source-level authorization checks do not establish operational coverage. | Open |
| Media | Native uploads enforce a 4 MiB total limit. Image/video persistence, signatures, private delivery and seeking have automated coverage. Larger uploads require object storage and a media-processing service before they can be offered. | Limited |
| Recovery operations | Record the production database backup and restore procedure and validate a restoration before launch. | Unverified |

## Release verification

Run from a clean checkout with a local file database and development credentials:

```sh
npm ci
npx prisma generate
npm run build
npm run check
npm run experience:http
npm run launch:behavior
npm audit --audit-level=high
```

`check` includes HTTP diagnostics and needs a running local app. `experience:http` creates its own isolated database and production-mode server. `launch:behavior` uses an isolated database and a mocked Stripe transport; it is not evidence of a real Stripe payment. These suites must not create fixtures in production.

Behavioral coverage includes native posts and media, audience boundaries, comments, follows, bookmarks, messages, account isolation, concurrent rate limiting, gift replay and stacking, paid versus unsettled checkouts, product isolation, stale cancellations, recurring-payment cleanup, preference storage failures and guarded fixture deletion.

Review the deployed interface at desktop and mobile widths: Explore navigation, filters, guest permalinks, keyboard focus, settings, reduced motion and media playback. Verify actual native haptics on supported hardware; browser emulation cannot establish physical feedback.

## Review and remove fixtures

If the database has no administrator, the deployment operator can set `MESH_BOOTSTRAP_ADMIN_USERNAME` to the owner's exact existing username, scoped to Production, and deploy `main`. The build grants only that active account the initial role and records an audit entry in the same transaction. It refuses preview branches, missing accounts, suspended accounts, an existing administrator or a previous completed bootstrap. Remove the variable after verifying access. It never creates an account or changes credentials; ordinary users cannot invoke it.

The admin console has a **Test account cleanup** section with review, exact-username confirmation and an audit entry. Only authenticated administrators can use it. When both historical tester fixtures are present, remove `meshmetester2` first, because its identifying comment belongs to the first tester’s post.

For command-line operations, use an authorized terminal with the production `DATABASE_URL` and `DATABASE_AUTH_TOKEN` supplied securely. Do not put credentials in command history, commits or reports.

```sh
npm run accounts:fixtures
```

This command only lists candidates. It requires positive fixture evidence and protects administrators, connected identities and payment history. It does not match arbitrary usernames containing “test”. Review the returned immutable IDs, counts and precise protection reasons before deleting anything.

```sh
npm run accounts:fixtures -- --delete-id=REVIEWED_ID --confirm-username=REVIEWED_USERNAME
```

Each deletion rechecks identity, protected relationships and concurrent account changes in a transaction. Content and sessions cascade with the account. Re-run review, check the known public permalink and inspect discovery afterward. Protected candidates require a separate account-specific review; never disable the safeguards to sweep them away.

Demo seeding is restricted to local file databases. There is no production override.

## Presentation and provenance

Remove obsolete development-tool names and temporary build references from the current source and deployment configuration. Do not rewrite history or delete required license notices. Previously published commits and external copies cannot be made untraceable by a site update. Any feature that actually sends user data to a third-party service must retain accurate data-use disclosures.
