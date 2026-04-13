# mesh.me — iOS, iPad & Mac App

Native app for iPhone, iPad, and Mac built with [Capacitor](https://capacitorjs.com) wrapping the mesh.me Next.js web application.

## Architecture

The iOS app is a native shell (WKWebView) that loads the hosted mesh.me web application, enhanced with native capabilities:

- **Push Notifications** — APNs integration for real-time alerts
- **Haptic Feedback** — tactile responses on button taps, navigation, and interactions
- **Face ID / Touch ID** — biometric authentication support
- **Native Share Sheet** — system share for posts, profiles, and content
- **Keyboard Management** — proper keyboard avoidance and accessory bar
- **Safe Area Handling** — full support for notch, Dynamic Island, and home indicator
- **Deep Links** — `meshme://` URL scheme and universal links
- **Background Refresh** — silent push and background fetch
- **iPad Multitasking** — Split View and Slide Over support
- **Mac Catalyst** — runs natively on macOS via Catalyst

## Prerequisites

- **macOS** with Xcode 15+ installed (from Mac App Store)
- **Apple ID** (free Apple ID works for testing on your own devices)
- **Node.js 20+** and npm

## First Time Setup

If you just installed Xcode for the first time:

```bash
# 1. Install Xcode command line tools (if prompted)
xcode-select --install

# 2. Install dependencies
npm install

# 3. Sync web assets and plugins to the iOS project
npm run cap:sync

# 4. Open in Xcode
npm run cap:open
```

Then in Xcode:

1. In the **left sidebar**, click the blue **App** project icon (top of the file tree)
2. Click the **Signing & Capabilities** tab in the center panel
3. Check **"Automatically manage signing"** if not already checked
4. Under **Team**, click the dropdown → **Add an Account...** → sign in with your Apple ID
5. Select your name from the Team dropdown
6. At the top toolbar, choose a device:
   - **iPhone Simulator** (e.g. "iPhone 15 Pro") — no physical device needed
   - **Your iPhone/iPad** — plug in via USB, tap "Trust" on the device
   - **My Mac (Designed for iPad)** — runs as a Mac app
7. Press **Cmd + R** to build and run

> **Note:** A free Apple ID lets you run on your own devices and simulators.
> An Apple Developer Program membership ($99/yr) is only needed for App Store distribution.

## Project Structure

```
ios/
├── App/
│   ├── App/
│   │   ├── AppDelegate.swift      # App lifecycle + push notification handling
│   │   ├── Info.plist              # Permissions, capabilities, URL schemes
│   │   └── Assets.xcassets/        # App icons and splash screen
│   ├── App.xcodeproj/             # Xcode project
│   └── CapApp-SPM/                # Swift Package Manager dependencies
├── .gitignore
└── debug.xcconfig
```

### Native Bridge (`src/lib/native/`)

TypeScript modules that wrap Capacitor plugins with graceful web fallbacks:

| Module | Purpose |
|--------|---------|
| `platform.ts` | Platform detection (iOS, web, tablet) |
| `haptics.ts` | Impact, notification, and selection haptics |
| `push.ts` | Push notification registration and listeners |
| `share.ts` | Native share sheet with Web Share API fallback |
| `keyboard.ts` | Keyboard show/hide events and management |
| `status-bar.ts` | Status bar style, color, and visibility |

### React Hooks (`src/hooks/`)

| Hook | Purpose |
|------|---------|
| `use-haptics.ts` | Stable haptic feedback callbacks |
| `use-keyboard.ts` | Keyboard height and visibility tracking |
| `use-platform.ts` | Platform detection state |
| `use-safe-area.ts` | Safe area inset measurements |

## npm Scripts

| Script | Description |
|--------|-------------|
| `npm run build:ios` | Build Next.js + export static assets for iOS |
| `npm run cap:sync` | Sync web assets and plugins to iOS project |
| `npm run cap:open` | Open the iOS project in Xcode |
| `npm run cap:build` | Full build pipeline (build + sync) |

## Configuration

### Bundle ID
`me.mesh.app` — configured in `capacitor.config.ts`

### Server URL
In development, the app loads from the hosted Vercel deployment. For production, update `capacitor.config.ts`:

```typescript
server: {
  url: "https://your-production-domain.com",
}
```

### Permissions Configured

| Permission | Usage |
|-----------|-------|
| Camera | Profile photos and content creation |
| Photo Library | Sharing media in posts |
| Face ID | Biometric authentication |
| Contacts | Finding friends on the platform |
| Location | Nearby communities and events |
| Microphone | Audio for video posts |
| Push Notifications | Real-time alerts |

### URL Schemes
- **Custom scheme**: `meshme://` for deep linking
- **Universal links**: `mesh.me` and `www.mesh.me`

## Device Support

| Device | Minimum OS | Notes |
|--------|-----------|-------|
| iPhone | iOS 16+ | Full support |
| iPad | iPadOS 16+ | Multitasking, Split View |
| Mac | macOS 13+ | Via Mac Catalyst |

## App Store Submission

1. In Xcode, select **Product → Archive**
2. In the Organizer, click **Distribute App**
3. Choose **App Store Connect** and follow the prompts
4. Complete App Store listing in [App Store Connect](https://appstoreconnect.apple.com)

### App Store Metadata

- **Category**: Social Networking
- **Age Rating**: 12+ (social features)
- **Privacy URL**: https://mesh.me/privacy
- **Terms URL**: https://mesh.me/terms
- **Support URL**: https://mesh.me/about

## Troubleshooting

### Build fails with signing errors
Set your development team: Xcode → Target → Signing & Capabilities → Team

### Web content not loading
Check `capacitor.config.ts` → `server.url` points to a running server

### Push notifications not working
1. Ensure you have an Apple Developer Program membership
2. Create an APNs key in the Apple Developer portal
3. Add the Push Notifications capability in Xcode
4. Upload the key to your push notification service

### Safe areas not working
Ensure `viewport-fit=cover` is set in the viewport meta tag (already configured in `layout.tsx`)
