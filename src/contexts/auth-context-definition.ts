/**
 * @packageDocumentation
 * @module AuthContextDefinition
 * @description React context definitions for authentication state, extracted for Fast Refresh compatibility.
 * Provides split context pattern: separate contexts for state (read-only) and actions (mutations)
 * to minimize unnecessary re-renders and decouple state consumption from action availability.
 */

import { createContext } from "react";
import {
  AuthActionsContextValue,
  AuthContextType,
  AuthStateContextValue,
} from "../types/auth";

/**
 * Legacy unified authentication context combining state and actions.
 * Preserved for backward compatibility but not recommended for new code.
 * Use `AuthStateContext` and `AuthActionsContext` for better performance and separation of concerns.
 * @deprecated Use `AuthStateContext` and `AuthActionsContext` instead.
 * @source
 */
export const AuthContext = createContext<AuthContextType | undefined>(
  undefined,
);

/**
 * Context providing authentication state only (read-only).
 * Consumers using this context alone will not re-render when actions are triggered,
 * enabling efficient performance optimization through split context pattern.
 * @source
 */
export const AuthStateContext = createContext<
  AuthStateContextValue | undefined
>(undefined);

/**
 * Context providing authentication actions only (mutations).
 * Enables components to trigger auth operations (login, logout, refresh, etc.)
 * without subscribing to state changes, useful for action-only consumers.
 * @source
 */
export const AuthActionsContext = createContext<
  AuthActionsContextValue | undefined
>(undefined);
