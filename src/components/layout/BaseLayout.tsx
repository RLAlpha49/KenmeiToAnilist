/**
 * @packageDocumentation
 * @module BaseLayout
 * @description Main layout component providing header, footer, and content area for the application.
 */
import React from "react";
import { Header } from "./Header";
import { Footer } from "./Footer";

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
    <div className="bg-background text-foreground flex h-screen flex-col">
      <Header />

      <main className="flex-1 overflow-auto p-4">
        <div className="container mx-auto h-full">{children}</div>
      </main>

      <Footer />
    </div>
  );
}
