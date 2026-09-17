# Mesh.me public release checklist

Updated 17 September 2026. This document separates verified code behavior from production configuration. A green build is not a public-launch certificate.

## Production requirements

| Requirement | Evidence and next action | Status |
| --- | --- | --- |
| Canonical domain | Vercel serves `meshs.me` and `www.meshs.me`. Verify ownership and configure `mesh.me` before advertising that address. | Open |
| Connected accounts | Production `/api/system-status` reports no usable token-encryption key. Set a securely generated 32-byte `APP_DATA_ENCRYPTION_KEY` in Vercel, redeploy, then connect and disconnect each advertised provider with an authorized account. Never replace a working encryption key without a migration. | Blocked |
| Real payments | The connected Stripe account is in test mode and had no active prices or webhook endpoints. Production reports two configured checkout options, but a completed live payment, entitlement, refund and cancellation have not been demonstrated. Confirm the actual production Stripe account and matching live configuration. | Unverified |
| Gift payments | Production reports zero configured gift prices. Configure one-time prices matching the displayed amounts, or keep purchase controls unavailable. | Blocked |
| Recovery and verification email | Send and redeem a real recovery/verification email; establish ownership of the configured sender domain. | Unverified |
| Fixture cleanup | Public post and comment confirm `meshmetester1` and `meshmetester2`. Review production records and execute the exact-ID cleanup below. No production deletion has been performed by this release. | Open |
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

Use an authorized terminal with the production `DATABASE_URL` and `DATABASE_AUTH_TOKEN` supplied securely. Do not put credentials in command history, commits or reports.

```sh
npm run accounts:fixtures
```

This command only lists candidates. It requires positive fixture evidence and protects administrators, connected identities and payment history. It does not match arbitrary usernames containing “test”. Review the returned immutable IDs and counts before deleting anything. Remove `meshmetester2` first, because its identifying comment belongs to the first tester’s post.

```sh
npm run accounts:fixtures -- --delete-id=REVIEWED_ID --confirm-username=REVIEWED_USERNAME
```

Each deletion rechecks identity, protected relationships and concurrent account changes in a transaction. Content and sessions cascade with the account. Re-run review, check the known public permalink and inspect discovery afterward. Protected candidates require a separate account-specific review; never disable the safeguards to sweep them away.

Demo seeding is restricted to local file databases. There is no production override.

## Presentation and provenance

Remove obsolete development-tool names and temporary build references from the current source and deployment configuration. Do not rewrite history or delete required license notices. Previously published commits and external copies cannot be made untraceable by a site update. Any feature that actually sends user data to a third-party service must retain accurate data-use disclosures.
