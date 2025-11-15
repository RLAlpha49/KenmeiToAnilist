/**
 * Creates a Kenmei series URL from a manga title.
 *
 * Converts the title to lowercase, removes special characters, normalizes spaces,
 * and replaces spaces with hyphens.
 *
 * @param title - Manga title to format, or null/undefined.
 * @returns Formatted Kenmei series URL, or null if title is invalid.
 * @source
 */
export function createKenmeiUrl(title?: string | null): string | null {
  if (!title) return null;

  const formattedTitle = title
    .toLowerCase()
    .replaceAll("'", " ")
    .replaceAll(/[^\w\s-]/g, " ") // Replace special chars with spaces instead of removing
    .replaceAll(/\s+/g, " ") // Normalize spaces
    .trim() // Remove leading/trailing spaces
    .replaceAll(" ", "-") // Replace spaces with hyphens
    .replaceAll(/(^-+)|(-+$)/g, ""); // Remove hyphens at start/end

  return `https://www.kenmei.co/series/${formattedTitle}`;
}
