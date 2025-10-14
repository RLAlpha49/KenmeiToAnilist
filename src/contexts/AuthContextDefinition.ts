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

const legacyAuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthLegacyContext = legacyAuthContext;

/**
 * @deprecated Prefer `AuthStateContext` and `AuthActionsContext` for new code.
 */
export const AuthContext = legacyAuthContext;

/**
 * State-only context to minimise re-renders for auth consumers.
 */
export const AuthStateContext = createContext<
  AuthStateContextValue | undefined
>(undefined);

/**
 * Actions-only context that exposes auth operations.
 */
export const AuthActionsContext = createContext<
  AuthActionsContextValue | undefined
>(undefined);
