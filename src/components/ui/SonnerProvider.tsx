/**
 * @packageDocumentation
 * @module components/ui/sonner-provider
 * @description Sonner toast notification provider configuration.
 * @source
 */
import React from "react";
import { Toaster } from "sonner";

/**
 * Sonner toast provider component for displaying notifications.
 * Configured with top-right positioning and system theme support.
 * @returns Toaster provider element.
 * @source
 */
export function SonnerProvider() {
  return (
    <Toaster
      richColors
      position="top-right"
      theme="system"
      className="toaster-container"
    />
  );
}
