/**
 * Shared utility functions for filter operations used across multiple components.
 * Reduces code duplication for common filter toggle, select, and clear operations.
 */

/**
 * Generic toggle handler for array-based filters.
 * Adds item if not present, removes if already present.
 * @param items - Current array of selected items
 * @param item - Item to toggle
 * @returns Updated array with item toggled
 */
export const createToggleHandler = <T>(items: T[], item: T): T[] => {
  return items.includes(item)
    ? items.filter((i) => i !== item)
    : [...items, item];
};

/**
 * Create a handler function that toggles an item in a filter array.
 * @param currentValue - Current filter array value
 * @param item - Item to toggle
 * @param onUpdate - Callback to update the filter
 * @returns Handler function
 */
export const makeToggleHandler =
  <T>(
    currentValue: T[],
    item: T,
    onUpdate: (value: T[]) => void,
  ): (() => void) =>
  () => {
    onUpdate(createToggleHandler(currentValue, item));
  };

/**
 * Create a handler for selecting all items in a filter.
 * @param items - All available items
 * @param onUpdate - Callback to update the filter
 * @returns Handler function
 */
export const makeSelectAllHandler =
  <T>(items: T[], onUpdate: (value: T[]) => void): (() => void) =>
  () => {
    onUpdate([...items]);
  };

/**
 * Create a handler for clearing all items in a filter.
 * @param onUpdate - Callback to update the filter
 * @returns Handler function
 */
export const makeClearAllHandler =
  <T>(onUpdate: (value: T[]) => void): (() => void) =>
  () => {
    onUpdate([]);
  };

/**
 * Converts a Date to YYYY-MM-DD format using local date components.
 * Avoids toISOString() which can display the wrong calendar date in some time zones.
 * @param date - The date to format.
 * @returns Date string in YYYY-MM-DD format for use in date input value.
 */
export const toDateInputValue = (date: Date | null): string => {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/**
 * Parses a date input value (YYYY-MM-DD format) to a Date using local components.
 * Avoids timezone issues by constructing Date with local date components.
 * @param value - Date string in YYYY-MM-DD format (or empty string)
 * @returns Date object or null if value is empty
 */
export const parseDateInputValue = (value: string | null): Date | null => {
  if (!value) return null;
  const [yearStr, monthStr, dayStr] = value.split("-");
  const year = Number.parseInt(yearStr, 10);
  const month = Number.parseInt(monthStr, 10) - 1;
  const day = Number.parseInt(dayStr, 10);
  return new Date(year, month, day);
};
