import { createContext } from "react";
import { AuthContextType } from "../types/auth";

/**
 * React context for authentication state
 * Extracted into its own non-component file for Fast Refresh compatibility
 */
export const AuthContext = createContext<AuthContextType | undefined>(
  undefined,
);
