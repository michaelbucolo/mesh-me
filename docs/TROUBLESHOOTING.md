# mesh.me Testing and Troubleshooting

This repo has three layers of checks. Run the lightest useful command first, then move deeper only when the failure needs more evidence.

## Fast checks

```bash
npm run check
```

Runs lint, launch readiness, roadmap readiness, and platform diagnostics.

```bash
npm run diagnostics
```

Runs source, environment, database, HTTP, security-header, auth-redirect, protected-API, PWA, and SEO checks. It defaults to `NEXT_PUBLIC_APP_URL`, `MESH_DIAGNOSTICS_BASE_URL`, or `http://localhost:3000`.

Useful variants:

```bash
npm run diagnostics -- --base-url=http://localhost:3000
npm run diagnostics -- --json
npm run diagnostics -- --skip-http
npm run test:smoke
```

If `npm` is not available in the current shell, run the scripts directly with Node:

```bash
node scripts/platform-diagnostics.mjs --strict
node scripts/browser-smoke.mjs --base-url=http://localhost:3000
```

## Full verification

```bash
npm run verify
```

Runs lint, a production build, and diagnostics. Use this before deploys or before declaring a broad feature pass complete.

## Browser smoke checks

```bash
npm run test:browser
```

Validates the UI in a real browser:

- desktop, tablet, and mobile login rendering
- unknown identity opens inline account creation
- existing identity opens the password flow
- authenticated app routes render with a temporary local session
- no page errors, console errors, or horizontal overflow on checked routes

The browser smoke script requires Playwright. In Codex, run it with the bundled runtime by setting `NODE_PATH` to the bundled Node modules path. Outside Codex, install Playwright in your normal developer environment.

## Local production server

For production-like troubleshooting:

```bash
npm run build
npm run start
```

Then in another terminal:

```bash
npm run diagnostics -- --base-url=http://localhost:3000
npm run test:browser -- --base-url=http://localhost:3000
```

## What failures mean

- `env-auth-secret`: set a 32+ character `AUTH_SECRET`.
- `database-connectivity`: check `DATABASE_URL`, Prisma generation, and the local database file.
- `security-headers`: check `next.config.ts` and `src/proxy.ts`.
- `protected-page-redirect`: check the protected route lists and session cookie validation in `src/proxy.ts`.
- `protected-api-auth`: check API auth guards and `protectedApiPrefixes`.
- `mutation-origin-guard`: check same-origin protection in `src/proxy.ts` and `src/lib/request-guard.ts`.
- `unified-entry-flow`: restore stable `data-testid` hooks on the login/sign-up experience.
- `mesh-testability`: keep The Mesh canvas and controls accessible and testable.

## Recommended debugging order

1. Run `npm run diagnostics`.
2. Fix the first P0 failure.
3. Run `npm run test:browser` if the issue is visual, responsive, auth-flow, or route-flow related.
4. Run `npm run verify` before deploying.
5. If production differs from local, run diagnostics against the live URL with `--base-url`.
