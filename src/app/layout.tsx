import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";
import { ThemeProvider } from "@/components/theme-provider";
import { NativeInit } from "@/components/native-init";

export const metadata: Metadata = {
  title: "mesh.me — Your digital universe, remixed",
  description: "A creator-first social operating system that unifies identity, communities, and conversations in one private graph.",
  keywords: ["mesh.me", "digital identity", "unified social platform", "privacy-first", "social network", "universal social"],
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
    title: "mesh.me — Your digital universe, remixed",
    description: "Unify identity, communities, and conversations in one privacy-first social operating system.",
    siteName: "mesh.me",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "mesh.me — Your digital universe, remixed",
    description: "A creator-first social operating system for your full digital footprint.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
      <body className="app-shell-gradient font-sans antialiased" style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }}>
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
