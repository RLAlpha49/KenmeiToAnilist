/**
 * Cache storage singleton
 * @module cache/storage
 */

import type { MangaCache } from "./types";

/**
 * In-memory cache for manga search results. Authoritative cache used by the service.
 * @source
 */
export const mangaCache: MangaCache = {};

/**
 * Flag to track if cache event listeners have been registered.
 * @source
 */
let _listenersRegistered = false;

/**
 * Retrieves the listeners registration status flag.
 * @returns True if event listeners have been registered; false otherwise.
 * @source
 */
export function getListenersRegistered(): boolean {
  return _listenersRegistered;
}

/**
 * Sets the listeners registration status flag.
 * @param value - New flag value.
 * @returns void
 * @source
 */
export function setListenersRegistered(value: boolean): void {
  _listenersRegistered = value;
}

/**
 * Flag to track if the manga search service has been initialized.
 * @source
 */
let _serviceInitialized = false;

/**
 * Retrieves the service initialization status flag.
 * @returns True if the manga search service has been initialized; false otherwise.
 * @source
 */
export function getServiceInitialized(): boolean {
  return _serviceInitialized;
}

/**
 * Sets the service initialization status flag.
 * @param value - New flag value.
 * @returns void
 * @source
 */
export function setServiceInitialized(value: boolean): void {
  _serviceInitialized = value;
}
