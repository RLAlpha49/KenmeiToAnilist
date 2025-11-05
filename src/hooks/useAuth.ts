/**
 * @packageDocumentation
 * @module useAuth
 * @description Custom React hook for accessing the authentication context in the Kenmei to AniList sync tool.
 */

import { useContext, useMemo } from "react";
import {
  AuthActionsContext,
  AuthStateContext,
} from "../contexts/AuthContextDefinition";
import {
  AuthActionsContextValue,
  AuthContextType,
  AuthStateContextValue,
} from "../types/auth";

/**
 * Accesses the authentication state context.
 * @returns Authentication state including user, isAuthenticated, and tokens.
 * @throws {Error} When used outside an AuthProvider.
 * @source
 */
export function useAuthState(): AuthStateContextValue {
  const context = useContext(AuthStateContext);
  if (context === undefined) {
    throw new Error("useAuthState must be used within an AuthProvider");
  }
  return context;
}

/**
 * Accesses the authentication actions context.
 * @returns Authentication action functions including login and logout.
 * @throws {Error} When used outside an AuthProvider.
 * @source
 */
export function useAuthActions(): AuthActionsContextValue {
  const context = useContext(AuthActionsContext);
  if (context === undefined) {
    throw new Error("useAuthActions must be used within an AuthProvider");
  }
  return context;
}

/**
 * Accesses the complete authentication context combining state and actions.
 * Merges both contexts for convenient single-hook access to auth data and methods.
 * @returns Merged authentication context with state and action methods.
 * @throws {Error} When used outside an AuthProvider.
 * @source
 */
export function useAuth(): AuthContextType {
  const stateContext = useContext(AuthStateContext);
  const actionsContext = useContext(AuthActionsContext);

  const mergedContext = useMemo(() => {
    if (stateContext !== undefined && actionsContext !== undefined) {
      return {
        ...stateContext,
        ...actionsContext,
      } satisfies AuthContextType;
    }

    return undefined;
  }, [actionsContext, stateContext]);

  if (mergedContext === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return mergedContext;
}
