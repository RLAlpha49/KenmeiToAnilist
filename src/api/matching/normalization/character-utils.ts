/**
 * Character normalization utilities for manga title matching.
 * Handles Cyrillic-to-Latin transliteration and punctuation removal.
 * @module normalization/character-utils
 */

/**
 * Replace Cyrillic and common homoglyph characters with Latin transliterations.
 * Handles single-letter homoglyphs, multi-letter transliterations, and removes
 * Cyrillic signs (soft/hard sign).
 * @param str - Input string to normalize.
 * @returns Normalized string with Cyrillic characters replaced by Latin equivalents.
 * @source
 */
export function replaceSpecialChars(str: string): string {
  const map = new Map<string, string>([
    // Basic Cyrillic -> Latin
    ["\u043E", "o"],
    ["\u041E", "O"],
    ["\u0430", "a"],
    ["\u0410", "A"],
    ["\u0435", "e"],
    ["\u0415", "E"],
    ["\u0441", "c"],
    ["\u0421", "C"],
    ["\u0440", "p"],
    ["\u0420", "P"],

    // Single-letter homoglyphs
    ["\u043A", "k"],
    ["\u041A", "K"],
    ["\u043C", "m"],
    ["\u041C", "M"],
    ["\u043D", "n"],
    ["\u041D", "N"],
    ["\u0442", "t"],
    ["\u0422", "T"],
    ["\u0445", "x"],
    ["\u0425", "X"],
    ["\u0432", "v"],
    ["\u0412", "V"],
    ["\u0443", "u"],
    ["\u0423", "U"],
    ["\u0456", "i"],
    ["\u0406", "I"],
    ["\u0458", "j"],
    ["\u0408", "J"],

    // Multi-letter transliterations
    ["\u0451", "yo"],
    ["\u0401", "Yo"],
    ["\u044E", "yu"],
    ["\u042E", "Yu"],
    ["\u044F", "ya"],
    ["\u042F", "Ya"],
    ["\u0436", "zh"],
    ["\u0416", "Zh"],
    ["\u0447", "ch"],
    ["\u0427", "Ch"],
    ["\u0448", "sh"],
    ["\u0428", "Sh"],
    ["\u0449", "shch"],
    ["\u0429", "Shch"],
    ["\u0446", "ts"],
    ["\u0426", "Ts"],
    ["\u044B", "y"],
    ["\u042B", "Y"],
    ["\u044D", "e"],
    ["\u042D", "E"],

    // Signs -> remove
    ["\u044C", ""],
    ["\u042C", ""],
    ["\u044A", ""],
    ["\u042A", ""],
  ]);

  return Array.from(str)
    .map((ch) => map.get(ch) ?? ch)
    .join("");
}

/**
 * Removes punctuation and special characters from a string.
 * Preserves word characters and spaces only.
 * @param str - The string to clean.
 * @returns String with punctuation and special characters removed.
 * @source
 */
export function removePunctuation(str: string): string {
  return str.replaceAll(/[^\w\s]/g, "");
}
