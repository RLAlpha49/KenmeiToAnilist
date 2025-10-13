/**
 * @packageDocumentation
 * @module Matching/Normalization/CharacterUtils
 * @description Character and punctuation normalization utilities
 */

/**
 * Replaces Cyrillic characters with their Latin equivalents
 *
 * @param str - The string to process
 * @returns String with Cyrillic characters replaced
 *
 * @example
 * ```typescript
 * replaceSpecialChars("Соло Левелинг")
 * // Returns: "Cоло Левелинг" (partial replacement)
 * ```
 */
export function replaceSpecialChars(str: string): string {
  return str
    .replaceAll("о", "o")
    .replaceAll("а", "a")
    .replaceAll("е", "e")
    .replaceAll("О", "O")
    .replaceAll("А", "A")
    .replaceAll("Е", "E")
    .replaceAll("с", "c")
    .replaceAll("С", "C")
    .replaceAll("р", "p")
    .replaceAll("Р", "P");
}

/**
 * Removes punctuation and special characters from a string
 *
 * @param str - The string to clean
 * @returns String with punctuation removed
 *
 * @example
 * ```typescript
 * removePunctuation("Hello, World!")
 * // Returns: "Hello World"
 * ```
 */
export function removePunctuation(str: string): string {
  return str.replaceAll(/[^\w\s]/g, "");
}
