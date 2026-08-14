# mesh.me — native SwiftUI app

mesh.me rebuilt in Swift and SwiftUI for iPhone, iPad, and Mac
("Designed for iPad"). This is NOT the Capacitor shell (`ios/App` wraps the
website in a WKWebView); this app renders every surface natively and talks to
the production backend at https://meshs.me over its JSON API.

The website stays what it is — SwiftUI cannot serve a web page, and web and
Android users keep the full product at meshs.me. This app is the same product
speaking each platform's native language: one palette (ported verbatim from
`src/app/tokens.css`), one five-tab law (Mesh, MeChat, Flow, Explore,
Analytics), one backend.

## Build & run (requires a Mac with Xcode 15+)

```bash
brew install xcodegen        # once
cd apple/MeshMe
xcodegen generate            # writes MeshMe.xcodeproj from project.yml
open MeshMe.xcodeproj
```

Then in Xcode: Signing & Capabilities → "Automatically manage signing" +
your team (same steps as IOS_APP.md), pick a simulator or device, Cmd+R.

`MeshMe.xcodeproj` is generated output — never commit it. `project.yml` is
the source of truth.

## Architecture

- `MeshMe/Design/MeshTheme.swift` — the web token sheet, ported. If a color
  moves in `src/app/tokens.css`, it moves here; `scripts/swift-app-check.ts`
  holds the pairing.
- `MeshMe/Core/MeshAPI.swift` — one URLSession client. Auth is the same
  `__Host-mesh_session` cookie the website uses; write requests carry an
  explicit `Origin: https://meshs.me` so the backend's same-origin guard
  treats the first-party app as first-party.
- `MeshMe/Features/` — one folder per tab plus Auth and shared Components.

## What is native today (slice 1)

Sign-in (the design north-star, natively), the five-tab shell, MeChat
(threads + messages + send), Flow (media stream), Explore, Analytics
overview, and the Mesh tab's "wants you" triage. Later slices: the full
mesh canvas scene, composer with cross-posting, push notifications, and
everything else the web does.

## Verification

Swift does not compile on the repo's Linux CI, and SwiftUI only compiles in
Apple SDKs — so CI holds this app with `scripts/swift-app-check.ts`
(structure, five-tab law, token pairing with tokens.css, and a cross-file
assert that every API path the Swift client calls exists as a real route
under `src/app/api/`). Compiling and running is the Mac's job, via the steps
above. No macOS CI runners are configured deliberately: they bill at a
premium and the owner has not approved that spend.
