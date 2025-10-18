/**
 * @packageDocumentation
 * @module AuthContextDefinition
 * @description React context for authentication state, extracted for Fast Refresh compatibility.
 */

import { createContext } from "react";
import {
  AuthActionsContextValue,
  AuthContextType,
  AuthStateContextValue,
} from "../types/auth";

/**
 * Legacy unified auth context combining state and actions.
 * @deprecated Prefer `AuthStateContext` and `AuthActionsContext` for new code.
 * @source
 */
export const AuthContext = createContext<AuthContextType | undefined>(
  undefined,
);

/**
 * Provides authentication state only (read-only), minimizing re-renders for consumers.
 * @source
 */
export const AuthStateContext = createContext<
  AuthStateContextValue | undefined
>(undefined);

/**
 * Provides authentication actions only, enabling mutations without state subscriptions.
 * @source
 */
export const AuthActionsContext = createContext<
  AuthActionsContextValue | undefined
>(undefined);
