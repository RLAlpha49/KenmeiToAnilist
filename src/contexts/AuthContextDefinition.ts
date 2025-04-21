/**
 * @packageDocumentation
 * @module AuthContextDefinition
 * @description React context for authentication state, extracted for Fast Refresh compatibility.
 */

import { createContext } from "react";
import { AuthContextType } from "../types/auth";

/**
 * React context for authentication state.
 *
 * @remarks
 * Extracted into its own non-component file for Fast Refresh compatibility.
 *
 * @source
 */
export const AuthContext = createContext<AuthContextType | undefined>(
  undefined,
);
