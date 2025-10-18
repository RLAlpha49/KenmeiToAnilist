/**
 * @packageDocumentation
 * @module useAuth
 * @description Custom React hook for accessing the authentication context in the Kenmei to AniList sync tool.
 */

import { useContext, useMemo } from "react";
import {
  AuthActionsContext,
  AuthLegacyContext,
  AuthStateContext,
} from "../contexts/AuthContextDefinition";
import {
  AuthActionsContextValue,
  AuthContextType,
  AuthStateContextValue,
} from "../types/auth";

/**
 * Accesses the authentication state context.
 * @returns The current authentication state.
 * @throws {Error} If used outside an AuthProvider.
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
 * @returns The current authentication actions.
 * @throws {Error} If used outside an AuthProvider.
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
 * Accesses the complete authentication context, merging state and actions.
 * Attempts to use the legacy context first, then falls back to split state/actions.
 * @returns The merged authentication context.
 * @throws {Error} If used outside an AuthProvider.
 * @source
 */
export function useAuth(): AuthContextType {
  const legacyContext = useContext(AuthLegacyContext);
  const stateContext = useContext(AuthStateContext);
  const actionsContext = useContext(AuthActionsContext);

  const mergedContext = useMemo(() => {
    if (legacyContext !== undefined) {
      return legacyContext;
    }

    if (stateContext !== undefined && actionsContext !== undefined) {
      return {
        ...stateContext,
        ...actionsContext,
      } satisfies AuthContextType;
    }

    return undefined;
  }, [actionsContext, legacyContext, stateContext]);

  if (mergedContext === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return mergedContext;
}
