# Design System

Mesh.me uses one shared UI foundation for public pages, authenticated app surfaces, settings, Meshi, the Feed, MeChat, and the Mesh. The goal is a familiar, calm interface that works in light mode, dark mode, mobile, tablet, desktop, and spatial browsers.

## Principles

- Keep primary actions obvious and close to the content they affect.
- Use restrained surfaces, readable contrast, and short copy.
- Prefer familiar controls over decorative custom UI.
- Preserve keyboard navigation, screen-reader labels, focus rings, and reduced-motion behavior.
- Use Meshi and constellation styling as identity moments, not as clutter around every control.

## Tokens

Global tokens live in `src/app/globals.css`.

- Color: `--bg-*`, `--text-*`, `--accent`, `--ds-danger`, `--ds-success`, `--ds-warning`
- Borders: `--border-*`, `--ds-border`, `--ds-border-strong`
- Spacing: `--ds-space-*`
- Radius: `--ds-radius-*`
- Controls: `--ds-control-height-*`
- Motion: `--ds-duration-*`, `--ds-ease`
- Shadows: `--ds-shadow-card`, `--ds-shadow-floating`

Use semantic variables instead of hard-coded colors. This keeps system light/dark behavior consistent.

## Components

Reusable primitives live in `src/components/ui`.

- `Button`: actions, icons, loading states, link-style commands
- `Card`: repeated content containers
- `Panel`, `PageShell`, `SectionHeader`: page structure and glass/surface panels
- `Input`, `Field`, `Textarea`: forms with labels, descriptions, errors
- `Modal` and dialog primitives: accessible overlays
- `NavList`, `NavLink`, `SegmentedControl`: navigation and mode switching
- `Skeleton`, `LoadingState`, `LoadingList`: loading surfaces
- `EmptyState`, `ErrorState`, `ErrorBoundary`: empty and failure states
- `Badge`: statuses and metadata
- `H1`, `H2`, `H3`, `Text`, `Muted`, `Kbd`: typography

Import primitives directly from their files for new work, for example `@/components/ui/button` and `@/components/ui/card`.

## Usage

```tsx
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { SectionHeader } from "@/components/ui/panel";

export function Example() {
  return (
    <Card hover>
      <CardContent className="grid gap-4 pt-4">
        <SectionHeader title="Connect YouTube" description="Sync videos, comments, likes, and analytics." />
        <Field label="Channel URL" description="Use the official channel link.">
          <Input placeholder="https://youtube.com/@mesh" />
        </Field>
        <Button>Connect account</Button>
      </CardContent>
    </Card>
  );
}
```

## Accessibility

- Interactive components include visible focus states through `ds-focus-ring`.
- Loading states use `role="status"` and do not block reduced-motion users.
- Error states use `role="alert"`.
- Modals use Radix Dialog primitives for focus management and escape handling.
- New controls should be reachable by keyboard and should not rely on color alone.

## Motion

Motion should feel quick and useful:

- Hover: border/background change, minimal lift.
- Press: tiny scale feedback.
- Loading: subtle shimmer or spinner.
- Page transitions: short fade/slide only.

All motion must respect `prefers-reduced-motion`.
