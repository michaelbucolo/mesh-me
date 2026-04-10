import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: "mesh.me — Your digital universe, remixed",
  description: "A creator-first social operating system that unifies identity, communities, and conversations in one private graph.",
  keywords: ["mesh.me", "digital identity", "unified social platform", "privacy-first", "social network", "universal social"],
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/meshi-favicon.svg",
    apple: "/meshi-favicon.svg",
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
            {children}
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
