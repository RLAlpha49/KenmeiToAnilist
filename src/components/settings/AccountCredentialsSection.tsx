/**
 * @packageDocumentation
 * @module AccountCredentialsSection
 * @description Account credentials section for authentication and API credential management.
 */

import React from "react";
import { motion } from "framer-motion";
import { Clock, Key, ShieldCheck, AlertTriangle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { DEFAULT_AUTH_PORT } from "@/config/anilist";
import type { AuthState } from "@/types/auth";

interface AccountCredentialsSectionProps {
  authState: AuthState;
  isLoading: boolean;
  useCustomCredentials: boolean;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  defaultCredentialStatus: { hasCredentials: boolean; missing: string[] };
  customCredentialStatus: { complete: boolean; missing: string[] };
  credentialSourceLabel: string;
  expiresLabel: string | undefined;
  onToggleCustomCredentials: (value: boolean) => void;
  onClientIdChange: (value: string) => void;
  onClientSecretChange: (value: string) => void;
  onRedirectUriChange: (value: string) => void;
}

/**
 * Account credentials section component.
 * Handles custom credential toggle and input fields for API authentication.
 *
 * @source
 */
export function AccountCredentialsSection({
  authState,
  isLoading,
  useCustomCredentials,
  clientId,
  clientSecret,
  redirectUri,
  defaultCredentialStatus,
  customCredentialStatus,
  credentialSourceLabel,
  expiresLabel,
  onToggleCustomCredentials,
  onClientIdChange,
  onClientSecretChange,
  onRedirectUriChange,
}: Readonly<AccountCredentialsSectionProps>) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-md dark:border-white/10 dark:bg-white/5"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            API Credentials
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-200/60">
            Choose between default or custom AniList OAuth credentials
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge
            variant={authState.isAuthenticated ? "default" : "secondary"}
            className="shrink-0"
          >
            {authState.isAuthenticated ? "Session Active" : "No Session"}
          </Badge>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-700 dark:text-slate-200/80">
              Use custom credentials
            </span>
            <Switch
              checked={useCustomCredentials}
              onCheckedChange={onToggleCustomCredentials}
              disabled={authState.isAuthenticated || isLoading}
            />
          </div>
        </div>
      </div>

      {authState.isAuthenticated && (
        <Alert
          variant="destructive"
          className="mt-4 border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/40 dark:bg-rose-500/10 dark:text-rose-100"
        >
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs text-rose-600 dark:text-rose-100">
            You must sign out before changing API credentials.
          </AlertDescription>
        </Alert>
      )}

      {!authState.isAuthenticated && (
        <Alert className="mt-4 border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-50">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="text-amber-700 dark:text-amber-50">
            Not connected
          </AlertTitle>
          <AlertDescription className="text-xs text-amber-600 dark:text-amber-100/80">
            Authenticate with AniList using the hero actions above to enable
            migrations.
          </AlertDescription>
        </Alert>
      )}

      {!useCustomCredentials && !defaultCredentialStatus.hasCredentials && (
        <Alert className="mt-4 border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-100">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="text-amber-700 dark:text-amber-100">
            Default credentials missing
          </AlertTitle>
          <AlertDescription className="text-xs text-amber-600 dark:text-amber-100/80">
            The following required credentials are missing:{" "}
            {defaultCredentialStatus.missing.join(", ")}. Please enable custom
            credentials and provide your own AniList OAuth app credentials, or
            contact the developer.
          </AlertDescription>
        </Alert>
      )}

      {useCustomCredentials && (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="grid gap-1.5">
            <label
              htmlFor="client-id"
              className="text-xs font-medium text-slate-700 dark:text-slate-200"
            >
              Client ID
            </label>
            <input
              id="client-id"
              type="text"
              className="w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:bg-slate-950/60 dark:text-white dark:focus-visible:ring-indigo-400 dark:focus-visible:ring-offset-0"
              value={clientId}
              onChange={(e) => onClientIdChange(e.target.value)}
              disabled={authState.isAuthenticated || isLoading}
              placeholder="Your AniList client ID"
            />
          </div>
          <div className="grid gap-1.5">
            <label
              htmlFor="client-secret"
              className="text-xs font-medium text-slate-700 dark:text-slate-200"
            >
              Client Secret
            </label>
            <input
              id="client-secret"
              type="password"
              className="w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:bg-slate-950/60 dark:text-white dark:focus-visible:ring-indigo-400 dark:focus-visible:ring-offset-0"
              value={clientSecret}
              onChange={(e) => onClientSecretChange(e.target.value)}
              disabled={authState.isAuthenticated || isLoading}
              placeholder="Your AniList client secret"
            />
          </div>
          <div className="grid gap-1.5 md:col-span-2">
            <label
              htmlFor="redirect-uri"
              className="text-xs font-medium text-slate-700 dark:text-slate-200"
            >
              Redirect URI
            </label>
            <input
              id="redirect-uri"
              type="text"
              className="w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:bg-slate-950/60 dark:text-white dark:focus-visible:ring-indigo-400 dark:focus-visible:ring-offset-0"
              value={redirectUri}
              onChange={(e) => onRedirectUriChange(e.target.value)}
              disabled={authState.isAuthenticated || isLoading}
              placeholder={`http://localhost:${DEFAULT_AUTH_PORT}/callback`}
            />
            <p className="text-xs text-slate-500 dark:text-slate-200/50">
              Must match the redirect URI in your AniList OAuth app settings
            </p>
          </div>
          <p className="text-xs text-slate-600 md:col-span-2 dark:text-slate-200/70">
            You can create a new client in{" "}
            <a
              href="https://anilist.co/settings/developer"
              className="font-medium text-blue-600 underline decoration-blue-600/30 underline-offset-2 transition-colors hover:text-blue-700 hover:decoration-blue-700/50 dark:text-blue-400 dark:decoration-blue-400/30 dark:hover:text-blue-300 dark:hover:decoration-blue-300/50"
              target="_blank"
              rel="noopener noreferrer"
            >
              AniList Developer Settings
            </a>{" "}
            . Use the redirect URI exactly as specified above.
          </p>
          {!customCredentialStatus.complete && (
            <Alert className="border-rose-200 bg-rose-50 text-rose-700 md:col-span-2 dark:border-rose-400/40 dark:bg-rose-500/10 dark:text-rose-100">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs text-rose-600 dark:text-rose-100">
                Please provide all required fields:{" "}
                {customCredentialStatus.missing.join(", ")}
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-200/80">
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700 dark:border-white/15 dark:bg-white/10 dark:text-slate-200/80">
          <Clock className="h-3 w-3" />
          {authState.isAuthenticated && expiresLabel
            ? `Expires in ${expiresLabel}`
            : "Not authenticated"}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700 dark:border-white/15 dark:bg-white/10 dark:text-slate-200/80">
          <Key className="h-3 w-3" />
          {credentialSourceLabel}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700 dark:border-white/15 dark:bg-white/10 dark:text-slate-200/80">
          <ShieldCheck className="h-3 w-3" />
          Stored locally only
        </span>
      </div>
    </motion.div>
  );
}
