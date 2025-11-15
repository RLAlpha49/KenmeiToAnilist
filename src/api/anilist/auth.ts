/**
 * @packageDocumentation
 * @module anilist-auth
 * @description AniList OAuth token exchange helper for re-use between main and renderer processes.
 */

import {
  TokenExchangeParams,
  TokenResponse,
  TokenExchangeResponse,
} from "../../types/api";
import { RATE_LIMIT_CONFIG } from "../../config/anilist";

/**
 * Exchange an OAuth authorization code for an access token with AniList.
 * Centralized helper to avoid duplicated token exchange logic and provide consistent error handling.
 *
 * IMPORTANT: This helper assumes a runtime with a global `fetch` and `AbortController` (e.g., Electron main process
 * running a recent Node/Electron runtime). If your environment does not provide these globals, you can pass in
 * explicit implementations via the optional `deps` parameter.
 *
 * @param params - Token exchange parameters
 * @param deps - Optional dependency injection for `fetch` and `AbortController` implementations.
 */
export async function exchangeToken(
  params: TokenExchangeParams,
  deps?: { fetch?: typeof fetch; AbortController?: typeof AbortController },
): Promise<TokenExchangeResponse> {
  const { clientId, clientSecret, redirectUri, code } = params;

  try {
    // Prefer injected implementations, then global runtime implementations
    const fetchImpl =
      deps?.fetch ?? (typeof fetch === "function" ? fetch : undefined);
    const AbortControllerImpl =
      deps?.AbortController ??
      (typeof AbortController === "function" ? AbortController : undefined);

    // Runtime guard to fail explicitly when required network primitives are unavailable
    if (!fetchImpl || !AbortControllerImpl) {
      const missing = [] as string[];
      if (!fetchImpl) missing.push("fetch");
      if (!AbortControllerImpl) missing.push("AbortController");
      const msg = `exchangeToken requires global ${missing.join(", ")} support (or pass implementations via the deps parameter)`;
      throw new Error(msg);
    }
    const body = {
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
    };

    const tokenData = await fetchAndParseToken(
      fetchImpl,
      AbortControllerImpl,
      body,
    );
    // Validate token structure
    if (
      !tokenData ||
      typeof tokenData.access_token !== "string" ||
      tokenData.access_token.length === 0
    ) {
      return {
        success: false,
        error: "Invalid token response: missing access_token",
      };
    }
    if (
      !tokenData.expires_in ||
      typeof tokenData.expires_in !== "number" ||
      tokenData.expires_in <= 0
    ) {
      return {
        success: false,
        error: "Invalid token response: missing or invalid expires_in",
      };
    }

    return { success: true, token: tokenData };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Token exchange failed: ${errorMessage}` };
  }
}

async function fetchAndParseToken(
  fetchImpl: typeof fetch,
  AbortControllerImpl: typeof AbortController,
  body: Record<string, unknown>,
): Promise<TokenResponse> {
  const controller = new AbortControllerImpl();
  const timeoutMs = RATE_LIMIT_CONFIG?.requestTimeout ?? 12000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl("https://anilist.co/api/v2/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      const short =
        text && text.length > 256 ? `${text.substring(0, 256)}…` : text;
      const errMsg =
        `HTTP ${response.status}: ${response.statusText}` +
        (short ? ` - ${short}` : "");
      throw new Error(errMsg);
    }
    const tokenData = (await response.json()) as TokenResponse;
    return tokenData;
  } finally {
    clearTimeout(timeout);
  }
}
