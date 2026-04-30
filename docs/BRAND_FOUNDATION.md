# Mesh.me Brand Foundation

## Core Identity

**Name:** Mesh.me  
**Motto:** Your World, Your Way  
**Category:** Privacy-first social media and digital identity hub  
**Promise:** One private home for your social world.

Mesh.me should feel like the user is entering and controlling their own digital world, not joining another ad-driven social network.

## Meshi

Meshi is the logo, mascot, and user vessel.

Visual rules:

- Simple bubble body
- Two eyes
- No mouth
- Minimal accessories
- Hands only when holding something
- Friendly, calm, and recognizable at favicon size

Meshi should represent the user across the platform. The default mark is intentionally simple so each user can personalize Meshi without losing the core identity.

## Color Palette

| Token | Hex | Use |
| --- | --- | --- |
| `--brand-ink` | `#0f141b` | Dark app background, OG base |
| `--brand-surface` | `#151b24` | Primary dark surfaces |
| `--brand-raised` | `#1b2430` | Raised dark surfaces |
| `--brand-white` | `#f7f9fc` | Light text and light app background |
| `--brand-muted` | `#9aa7b8` | Secondary text |
| `--brand-meshi-blue` | `#58a6ff` | Primary Meshi and action accent |
| `--brand-meshi-blue-light` | `#79b8ff` | Hover and highlight accent |
| `--brand-privacy-green` | `#22c55e` | Trust, safety, success |
| `--brand-warning-amber` | `#f59e0b` | Warnings and attention states |
| `--brand-danger-red` | `#ef4444` | Destructive and critical states |

The palette should stay clean and familiar. Use blue as the primary identity color, green for trust, amber for caution, and red only for destructive or critical actions.

## Copy Tone

Mesh.me should sound:

- Calm
- Clear
- Personal
- Direct
- Consumer-first

Use:

- Short, concrete sentences
- Privacy and control language
- Source-credit and permission language
- Human phrasing over corporate phrasing

Avoid:

- Ad-tech language
- Hype without product meaning
- Manipulative urgency
- Dense legal copy in normal UI
- Making Meshi sound childish

## Standard Copy

Primary line:

> Your World, Your Way.

Trust line:

> Private. Secure. No ads. No data selling.

Short description:

> One private home for your social world.

Long description:

> Mesh.me is a privacy-first social media platform and digital identity hub that unifies your posts, messages, analytics, privacy controls, and online identity in one place.

Open Graph description:

> Enter one private hub for your posts, messages, analytics, privacy controls, and digital identity. Your World, Your Way.

## Assets

- Favicon: `public/meshi-favicon.svg`
- App icon SVG: `public/meshi-icon.svg`
- Logo lockup: `public/meshi-logo.svg`
- Open Graph image route: `src/app/opengraph-image.tsx`
- Twitter image route: `src/app/twitter-image.tsx`
- Brand constants: `src/lib/brand.ts`

## Implementation Rule

New product and public-site copy should import from `src/lib/brand.ts` when referring to the platform name, motto, descriptions, trust line, or Meshi rules.
