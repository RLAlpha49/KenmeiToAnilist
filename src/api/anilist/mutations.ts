/**
 * @packageDocumentation
 * @module anilist-mutations
 * @description GraphQL mutations for AniList API, including dynamic update and delete mutations for manga entries.
 */

/**
 * Generates a dynamic UPDATE_MANGA_ENTRY mutation with only required variables.
 * Only includes variable declarations for fields present in the variables object.
 * Always includes mediaId as it's a required field.
 * @param variables - Object indicating which optional fields to include (status, progress, score, private).
 * @returns GraphQL mutation string for updating a manga entry.
 * @source
 */
export function generateUpdateMangaEntryMutation(
  variables: Record<string, string | number | boolean>,
): string {
  // Always include mediaId as it's required
  const variableDefinitions = ["$mediaId: Int!"];
  const parameters = ["mediaId: $mediaId"];

  // Add optional variables only if present in the variables object
  if ("status" in variables) {
    variableDefinitions.push("$status: MediaListStatus");
    parameters.push("status: $status");
  }

  if ("progress" in variables) {
    variableDefinitions.push("$progress: Int");
    parameters.push("progress: $progress");
  }

  if ("private" in variables) {
    variableDefinitions.push("$private: Boolean");
    parameters.push("private: $private");
  }

  if ("score" in variables) {
    variableDefinitions.push("$score: Float");
    parameters.push("score: $score");
  }

  // Generate the mutation with only necessary variables
  return `
mutation (${variableDefinitions.join(", ")}) {
  SaveMediaListEntry(${parameters.join(", ")}) {
    id
    status
    progress
    private
    score
  }
}
`;
}

/**
 * GraphQL mutation to delete a manga entry from AniList by its entry ID.
 * @source
 */
export const DELETE_MANGA_ENTRY = `
mutation ($id: Int) {
  DeleteMediaListEntry(id: $id) {
    deleted
  }
}
`;
