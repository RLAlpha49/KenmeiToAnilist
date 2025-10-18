/**
 * @packageDocumentation
 * @module BaseLayout
 * @description Main layout component providing header, footer, and content area for the application.
 */
import React from "react";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { BackgroundMatchingIndicator } from "./BackgroundMatchingIndicator";

/**
 * BaseLayout React component that provides the main application layout with header, footer, and content area.
 *
 * @param children - The content to render inside the layout.
 * @returns The rendered layout React element.
 * @source
 */
export default function BaseLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="from-background via-background to-background text-foreground relative flex h-screen flex-col overflow-hidden bg-gradient-to-br">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-10 h-72 w-72 rounded-full bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-transparent blur-3xl" />
        <div className="absolute right-[-60px] top-1/2 h-96 w-96 -translate-y-1/2 rounded-full bg-gradient-to-br from-emerald-500/10 via-teal-500/10 to-transparent blur-3xl" />
        <div className="absolute bottom-[-120px] left-1/2 h-80 w-[36rem] -translate-x-1/2 rounded-full bg-gradient-to-t from-amber-500/15 via-pink-500/10 to-transparent blur-[200px]" />
      </div>

      <Header />

      <BackgroundMatchingIndicator />

      <main className="relative z-[1] flex-1 overflow-auto px-4 py-6 md:px-6">
        <div className="container mx-auto">
          <div className="bg-background/70 rounded-3xl border border-white/20 p-0 shadow-[0_20px_80px_-50px_rgba(59,130,246,0.6)] backdrop-blur-xl transition-colors dark:border-white/5 dark:bg-slate-950/70">
            {children}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
