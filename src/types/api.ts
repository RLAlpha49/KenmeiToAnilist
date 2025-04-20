/**
 * @packageDocumentation
 * @module api-types
 * @description TypeScript types for API request and response parameters.
 */

/**
 * Parameters required for exchanging an authorization code for an access token.
 *
 * @property clientId - The client ID of the application.
 * @property clientSecret - The client secret of the application.
 * @property redirectUri - The redirect URI used in the OAuth flow.
 * @property code - The authorization code received from the OAuth provider.
 * @source
 */
export interface TokenExchangeParams {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
}
