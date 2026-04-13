import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "me.mesh.app",
  appName: "mesh.me",
  webDir: "out",

  // Server configuration — in development, point to the live site.
  // For production builds, the static export in `out/` is used instead.
  server: {
    // Use the hosted URL so SSR, API routes, and auth all work.
    url: "https://meshme.vercel.app",
    cleartext: false,
  },

  ios: {
    // Full-screen content extending behind status bar and home indicator
    contentInset: "always",
    backgroundColor: "#09090b",
    preferredContentMode: "mobile",
    scheme: "meshme",
    // Allow inline media playback and auto-play for mesh animations
    allowsLinkPreview: true,
    scrollEnabled: true,
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      launchFadeOutDuration: 300,
      backgroundColor: "#09090b",
      showSpinner: false,
      androidScaleType: "CENTER_CROP",
      splashFullScreen: true,
      splashImmersive: true,
    },

    StatusBar: {
      style: "DARK",
      backgroundColor: "#09090b",
      overlaysWebView: true,
    },

    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
