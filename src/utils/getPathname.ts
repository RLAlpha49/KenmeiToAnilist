/**
 * Extracts a pathname string from various location-like objects returned by different router implementations.
 *
 * @param loc - A location object that may contain pathname at various nesting levels.
 * @returns The extracted pathname string, or "/" if extraction fails.
 * @remarks
 * Checks multiple common nesting patterns to accommodate different router wrapper structures.
 * @source
 */
export function getPathname(loc: unknown): string {
  if (typeof loc !== "object" || loc === null) return "/";

  const keyPaths: Array<string[]> = [
    ["pathname"],
    ["current", "pathname"],
    ["current", "location", "pathname"],
    ["location", "pathname"],
  ];

  for (const path of keyPaths) {
    let cur: unknown = loc;
    let i = 0;
    while (i < path.length && typeof cur === "object" && cur !== null) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cur = (cur as any)[path[i]];
      i += 1;
    }
    if (typeof cur === "string") return cur;
  }

  return "/";
}
