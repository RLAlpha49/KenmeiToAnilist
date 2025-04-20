import React from "react";
import { Toaster } from "sonner";

export function SonnerProvider() {
  return (
    <Toaster
      richColors
      position="top-right"
      closeButton
      theme="system"
      className="toaster-container"
    />
  );
}
