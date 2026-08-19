import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import ThemeProvider from "@/components/ThemeProvider";
import AppShell from "@/components/AppShell";

// Self-hosted so production builds do not fetch Google Fonts at compile time.
const inter = localFont({
  src: "./fonts/inter-latin-wght-normal.woff2",
  variable: "--font-sans",
  display: "swap",
  weight: "100 900",
});

const spaceGrotesk = localFont({
  src: "./fonts/space-grotesk-latin-wght-normal.woff2",
  variable: "--font-display",
  display: "swap",
  weight: "300 700",
});

const jetbrainsMono = localFont({
  src: "./fonts/jetbrains-mono-latin-wght-normal.woff2",
  variable: "--font-mono",
  display: "swap",
  weight: "100 800",
});

export const metadata: Metadata = {
  title: {
    default: "SF Contacts",
    template: "%s · SF Contacts",
  },
  description: "Add, search, and manage contacts backed by the Contacts API.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}
    >
      <body
        className="min-h-screen bg-background font-sans text-foreground antialiased transition-colors duration-200"
        suppressHydrationWarning
      >
        {/* No Suspense boundary around the shell: it would let Next flush the
            HTML before a page calls notFound(), and the 404 status would be
            lost. Route-level loading.tsx supplies the streaming boundary. */}
        <ThemeProvider>
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
