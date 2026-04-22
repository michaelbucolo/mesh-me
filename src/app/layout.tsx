import type { Metadata, Viewport } from "next";
import type React from "react";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";
import { ThemeProvider } from "@/components/theme-provider";
import { NativeInit } from "@/components/native-init";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

function getSiteUrl() {
  const fallback = "https://meshme.vercel.app";
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (!raw) return fallback;

  try {
    return new URL(raw).toString().replace(/\/$/, "");
  } catch {
    return fallback;
  }
}

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Mesh.me | Your World, Your Way",
  description: "A privacy-first social media platform and digital identity hub for your full online world.",
  keywords: ["mesh.me", "digital identity", "unified social platform", "privacy-first", "social network", "universal social"],
  alternates: {
    canonical: "/",
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/meshi-favicon.svg",
    apple: [
      { url: "/icons/icon-152x152.png", sizes: "152x152", type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
  },
  applicationName: "mesh.me",
  appleWebApp: {
    capable: true,
    title: "mesh.me",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    url: siteUrl,
    title: "Mesh.me | Your World, Your Way",
    description: "Unify posts, messages, analytics, privacy, and identity in one consumer-first social platform.",
    siteName: "mesh.me",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Mesh.me | Your World, Your Way",
    description: "A privacy-first control center for your full digital footprint.",
  },
  category: "technology",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#09090b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${jakarta.variable} mesh-app-surface font-sans antialiased`}
        style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }}
      >
        <ThemeProvider>
          <ToastProvider>
            <NativeInit />
            {children}
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
