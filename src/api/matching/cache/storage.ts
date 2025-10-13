/**
 * Cache storage singleton
 * @module cache/storage
 */

import type { MangaCache } from "./types";

/**
 * In-memory cache for manga search results
 * This is the authoritative cache used by the service
 */
export const mangaCache: MangaCache = {};

/**
 * Flag to track if cache event listeners have been registered
 */
let _listenersRegistered = false;

/**
 * Get the listeners registered flag
 * @returns Current value of the flag
 */
export function getListenersRegistered(): boolean {
  return _listenersRegistered;
}

/**
 * Set the listeners registered flag
 * @param value - New value for the flag
 */
export function setListenersRegistered(value: boolean): void {
  _listenersRegistered = value;
}

/**
 * Flag to track if the service has been initialized
 */
let _serviceInitialized = false;

/**
 * Get the service initialized flag
 * @returns Current value of the flag
 */
export function getServiceInitialized(): boolean {
  return _serviceInitialized;
}

/**
 * Set the service initialized flag
 * @param value - New value for the flag
 */
export function setServiceInitialized(value: boolean): void {
  _serviceInitialized = value;
}
