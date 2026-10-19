import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Atkinson_Hyperlegible, Bricolage_Grotesque, IBM_Plex_Mono, Newsreader, Reenie_Beanie } from "next/font/google";
import { ClockCard, TimerService } from "@/components/Clock";
import { Nav } from "@/components/Nav";
import { PrefsSync } from "@/components/PrefsSync";
import { RedactionProvider } from "@/components/RedactionTransition";
import { ServiceWorker } from "@/components/ServiceWorker";
import { SettingsDrawer } from "@/components/SettingsDrawer";
import { Toasts } from "@/components/Toasts";
import { PAINT_SCRIPT } from "@/lib/prefs";
import "./globals.css";

const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"], axes: ["wdth", "opsz"] });
const newsreader = Newsreader({ variable: "--font-newsreader", subsets: ["latin"], style: ["normal", "italic"], axes: ["opsz"] });
const plexMono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["400", "500"] });
const reenie = Reenie_Beanie({ variable: "--font-reenie", subsets: ["latin"], weight: "400" });
// Optional reading font (Settings → Look). Not preloaded: it only downloads if someone picks it.
const atkinson = Atkinson_Hyperlegible({ variable: "--font-atkinson", subsets: ["latin"], weight: ["400", "700"], preload: false });

export const metadata: Metadata = {
  title: "Saboteur: study by catching the lies",
  description: "An AI study tool that writes convincing explanations with subtle planted errors, then makes you hunt them down.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#d9c8ac" },
    { media: "(prefers-color-scheme: dark)", color: "#22160c" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-GB" className={`${bricolage.variable} ${newsreader.variable} ${plexMono.variable} ${reenie.variable} ${atkinson.variable}`} suppressHydrationWarning>
      <head>
        {/* Settings, theme and desk applied before the first frame (lib/prefs.ts). */}
        <script dangerouslySetInnerHTML={{ __html: PAINT_SCRIPT }} />
      </head>
      <body>
        <div className="desk" aria-hidden="true">
          <div className="desk__photo" />
          <div className="desk__photo desk__photo--off" />
          <div className="desk__fx" />
          {/* The clock's camera move plays here, under the props and the menu (components/Clock.tsx). */}
          <div className="desk__pan" />
          <div className="desk__props" />
          <div className="desk__scrim" />
        </div>
        <PrefsSync />
        <RedactionProvider>
          <Suspense fallback={<div className="h-[76px]" />}>
            <Nav />
          </Suspense>
          {children}
        </RedactionProvider>
        <SettingsDrawer />
        <ClockCard />
        <TimerService />
        <Toasts />
        <ServiceWorker />
      </body>
    </html>
  );
}
