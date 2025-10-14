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
 * Custom React hook to access the authentication context.
 *
 * Throws an error if used outside of an AuthProvider.
 *
 * @returns The current authentication context value.
 *
 * @source
 */
export function useAuthState(): AuthStateContextValue {
  const context = useContext(AuthStateContext);
  if (context === undefined) {
    throw new Error("useAuthState must be used within an AuthProvider");
  }
  return context;
}

export function useAuthActions(): AuthActionsContextValue {
  const context = useContext(AuthActionsContext);
  if (context === undefined) {
    throw new Error("useAuthActions must be used within an AuthProvider");
  }
  return context;
}

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
