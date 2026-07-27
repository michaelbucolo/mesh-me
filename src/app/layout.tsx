import type { Metadata, Viewport } from "next";
import type React from "react";
import { Fraunces, IBM_Plex_Mono, Instrument_Sans } from "next/font/google";
import { Suspense } from "react";
import Script from "next/script";
import { MotionConfig } from "framer-motion";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { NavigationProgress } from "@/components/ui/navigation-progress";
import { RootClientEffects } from "@/components/root-client-effects";
import { ThemeProvider } from "@/components/theme-provider";
import { getBrandTitle, getSiteUrl, meshBrand } from "@/lib/brand";
import "./globals.css";

const siteUrl = getSiteUrl();

// The product had no typeface. `--font-inter` was a system-font stack that never
// loaded Inter, and `--font-mono` pointed at a variable that was never declared —
// so every screen rendered in whatever the OS happened to supply, which is why
// the same page looked like three different products on three different machines.
//
// Fraunces is the one deliberate choice here: a variable serif with optical
// sizing and a WONK axis, which is the strongest "made by a person" signal
// available in a typeface. Instrument Sans carries the interface — a humanist
// skeleton that stays warm at 13-17px, where almost all of this product lives.
// IBM Plex Mono handles anything that has to line up in a column.
const fraunces = Fraunces({
  subsets: ["latin"],
  // No `weight`: that is what loads Fraunces as a true variable font, which is
  // the only way to reach SOFT and WONK. WONK is the axis that lets the
  // terminals go slightly irregular — the difference between a serif and a
  // serif that looks like someone drew it.
  axes: ["SOFT", "WONK"],
  display: "swap",
  variable: "--font-display-loaded",
});

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-sans-loaded",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-mono-loaded",
});

const fontVariables = `${fraunces.variable} ${instrumentSans.variable} ${plexMono.variable}`;

const themeInitScript = `
(function () {
  function validMode(value) {
    return value === "light" || value === "dark" || value === "system";
  }

  function validPreset(value) {
    return value === "default" || value === "instagram" || value === "ocean" || value === "sunset" || value === "forest" || value === "mono";
  }

  function resolveSystemTheme() {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  // ── THE INK DERIVATION, AGAIN, BECAUSE THIS RUNS BEFORE ANY MODULE LOADS ──
  //
  // This script is beforeInteractive: it paints the saved theme on the very
  // first frame so a hard refresh does not flash the default palette. That is
  // also why it cannot import src/lib/readable-ink.ts, and why it used to set
  // --accent from a user-chosen colour while setting no ink at all — leaving the
  // inherited ink (white in light, #00204a in dark) on an arbitrary hue for the
  // whole initial render, and PERMANENTLY if the client bundle never runs.
  //
  // So the derivation is stated twice. scripts/contrast-check.ts extracts this
  // block and EXECUTES it against the module over a sweep of colours, asserting
  // identical output — a spelling check would pass any refactor that kept the
  // words, and two copies that are never compared are how this started.
  function lum(hex) {
    var h = hex.replace("#", "").trim();
    var full = h.length === 3 ? h[0] + h[0] + h[1] + h[1] + h[2] + h[2] : h;
    function ch(i) {
      var v = parseInt(full.slice(i * 2, i * 2 + 2), 16) / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }
    return 0.2126 * ch(0) + 0.7152 * ch(1) + 0.0722 * ch(2);
  }
  function ratio(a, b) {
    return a > b ? (a + 0.05) / (b + 0.05) : (b + 0.05) / (a + 0.05);
  }
  function isHex(v) {
    return typeof v === "string" && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v.trim());
  }
  function inkOn(fill) {
    if (!isHex(fill)) return "#ffffff";
    var l = lum(fill);
    return ratio(l, 0) >= ratio(l, 1) ? "#000000" : "#ffffff";
  }
  function toHsl(hex) {
    var h = hex.replace("#", "").trim();
    var full = h.length === 3 ? h[0] + h[0] + h[1] + h[1] + h[2] + h[2] : h;
    var r = parseInt(full.slice(0, 2), 16) / 255;
    var g = parseInt(full.slice(2, 4), 16) / 255;
    var b = parseInt(full.slice(4, 6), 16) / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
    if (max === min) return [0, 0, l];
    var d = max - min;
    var s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    var hue = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [hue / 6, s, l];
  }
  function fromHsl(h, s, l) {
    function f(p, q, t) {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    }
    function hx(v) {
      var n = Math.max(0, Math.min(255, Math.round(v * 255))).toString(16);
      return n.length === 1 ? "0" + n : n;
    }
    if (s === 0) return "#" + hx(l) + hx(l) + hx(l);
    var q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    return "#" + hx(f(p, q, h + 1 / 3)) + hx(f(p, q, h)) + hx(f(p, q, h - 1 / 3));
  }
  function accentText(accent, background) {
    if (!isHex(accent) || !isHex(background)) return accent;
    var bg = lum(background);
    if (ratio(lum(accent), bg) >= 4.6) return accent;
    var hsl = toHsl(accent), step = bg > 0.179 ? -0.004 : 0.004;
    for (var i = 1; i <= 250; i++) {
      var l = hsl[2] + step * i;
      if (l < 0 || l > 1) break;
      var candidate = fromHsl(hsl[0], hsl[1], l);
      if (ratio(lum(candidate), bg) >= 4.6) return candidate;
    }
    return bg > 0.179 ? "#000000" : "#ffffff";
  }

  function applyCustomTheme(root, customTheme) {
    if (!customTheme) return;
    root.setAttribute("data-custom-theme", "true");
    if (customTheme.accent) {
      root.style.setProperty("--accent", customTheme.accent);
      var ink = inkOn(customTheme.accent);
      root.style.setProperty("--accent-ink", ink);
      root.style.setProperty("--accent-contrast", ink);
      root.style.setProperty("--accent-text", accentText(customTheme.accent, customTheme.bgPrimary));
      root.style.setProperty("--accent-hover", customTheme.accent);
      root.style.setProperty("--accent-muted", customTheme.accent + "33");
      root.style.setProperty("--accent-subtle", customTheme.accent + "1f");
      root.style.setProperty("--brand-gradient", "linear-gradient(135deg, " + customTheme.accent + " 0%, " + (customTheme.textPrimary || customTheme.accent) + " 100%)");
      root.style.setProperty("--brand-gradient-vibrant", "linear-gradient(135deg, " + customTheme.accent + " 0%, " + (customTheme.bgSecondary || customTheme.accent) + " 50%, " + (customTheme.textPrimary || customTheme.accent) + " 100%)");
    }
    if (customTheme.bgPrimary) root.style.setProperty("--bg-primary", customTheme.bgPrimary);
    if (customTheme.bgSecondary) root.style.setProperty("--bg-secondary", customTheme.bgSecondary);
    if (customTheme.textPrimary) root.style.setProperty("--text-primary", customTheme.textPrimary);
    if (customTheme.textSecondary) root.style.setProperty("--text-secondary", customTheme.textSecondary);
    if (customTheme.borderPrimary) root.style.setProperty("--border-primary", customTheme.borderPrimary);
  }

  try {
    var root = document.documentElement;
    var storedMode = localStorage.getItem("mesh-theme");
    var mode = validMode(storedMode) ? storedMode : "dark";
    var resolved = mode === "system" ? resolveSystemTheme() : mode;
    var storedPreset = localStorage.getItem("mesh-theme-preset");
    var preset = validPreset(storedPreset) ? storedPreset : "default";
    var customTheme = null;
    var storedCustom = localStorage.getItem("mesh-theme-custom");

    if (storedCustom) customTheme = JSON.parse(storedCustom);

    root.classList.remove("light", "dark");
    root.classList.add(resolved);
    root.dataset.themeMode = mode;
    root.dataset.resolvedTheme = resolved;
    root.style.colorScheme = resolved;
    root.setAttribute("data-theme", preset);
    applyCustomTheme(root, customTheme);
  } catch (error) {
    document.documentElement.classList.add("dark");
    document.documentElement.style.colorScheme = "dark";
  }
})();
`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: getBrandTitle(),
    template: `%s | ${meshBrand.name}`,
  },
  description: meshBrand.description,
  keywords: ["Mesh.me", "Meshi", "digital identity", "unified social platform", "privacy-first", "social network", "MeChat", "The Mesh"],
  authors: [{ name: meshBrand.name }],
  creator: meshBrand.name,
  publisher: meshBrand.name,
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: meshBrand.assets.favicon, type: "image/svg+xml" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
    shortcut: meshBrand.assets.favicon,
    apple: [
      { url: "/icons/icon-152x152.png", sizes: "152x152", type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
  },
  applicationName: meshBrand.name,
  appleWebApp: {
    capable: true,
    title: meshBrand.name,
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    title: getBrandTitle(),
    description: meshBrand.openGraphDescription,
    siteName: meshBrand.name,
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: `${meshBrand.name} - ${meshBrand.motto}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: getBrandTitle(),
    description: meshBrand.openGraphDescription,
    images: ["/twitter-image"],
  },
  category: "technology",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light dark",
  // A single media-less value (matching the forced-dark first-visit default)
  // rather than a prefers-color-scheme array, so the theme provider can update
  // the browser chrome color on in-app theme switches.
  themeColor: meshBrand.colors.ink,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={fontVariables} suppressHydrationWarning>
      <body className="mesh-app-surface font-sans antialiased" style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }}>
        <Script id="mesh-theme-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <ThemeProvider>
          {/* Every framer-motion component inherits the user's OS reduced-motion
              preference — springs and transforms collapse to instant, opacity
              still fades, so the redesign never regresses accessibility. */}
          <MotionConfig reducedMotion="user">
            <Suspense fallback={null}>
              <NavigationProgress />
            </Suspense>
            {children}
            <RootClientEffects />
          </MotionConfig>
        </ThemeProvider>
        {/* Vercel Speed Insights — real-user Core Web Vitals for every route. */}
        <SpeedInsights />
      </body>
    </html>
  );
}
