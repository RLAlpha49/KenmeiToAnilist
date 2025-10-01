// Utility to create a Kenmei series URL from a manga title
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
