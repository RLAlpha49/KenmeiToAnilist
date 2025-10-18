/**
 * Creates a Kenmei series URL from a manga title.
 *
 * Formats the title by converting to lowercase, removing special characters,
 * normalizing spaces, and replacing spaces with hyphens.
 *
 * @param title - The manga title to format, or null/undefined.
 * @returns The formatted Kenmei series URL, or null if title is invalid.
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
