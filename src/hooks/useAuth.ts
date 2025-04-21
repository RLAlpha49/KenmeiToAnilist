/**
 * @packageDocumentation
 * @module useAuth
 * @description Custom React hook for accessing the authentication context in the Kenmei to AniList sync tool.
 */

import { useContext } from "react";
import { AuthContext } from "../contexts/AuthContextDefinition";
import { AuthContextType } from "../types/auth";

/**
 * Custom React hook to access the authentication context.
 *
 * Throws an error if used outside of an AuthProvider.
 *
 * @returns The current authentication context value.
 *
 * @source
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
