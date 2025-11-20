export enum CustomRuleWarningId {
  RedosVulnerability = "redos_vulnerability",
  BroadMatchesAllTitles = "broad_matches_all_titles",
  BroadMatchesBroadSets = "broad_matches_broad_sets",
  BroadUnanchoredRepeats = "broad_unanchored_repeats",
  PatternTooLong = "pattern_too_long",
}

export const CUSTOM_RULE_WARNING_MESSAGES: Record<CustomRuleWarningId, string> =
  {
    [CustomRuleWarningId.RedosVulnerability]:
      "⚠️ This pattern may cause performance issues (ReDoS vulnerability). Consider simplifying: avoid nested quantifiers like (a+)+, overlapping alternations like (a|aa)+, or catastrophic patterns like (.*a)*. See regex documentation for safer alternatives.",
    [CustomRuleWarningId.BroadMatchesAllTitles]:
      "⚠️ This pattern matches almost everything and will likely match all manga titles. Make sure this is intentional.",
    [CustomRuleWarningId.BroadMatchesBroadSets]:
      "⚠️ This pattern matches almost everything and will match very broad sets of titles. Make sure this is intentional.",
    [CustomRuleWarningId.BroadUnanchoredRepeats]:
      "⚠️ Pattern has multiple unbounded repeats without anchors. Consider using ^ or $ to make it more specific, or use bounded quantifiers like {1,100}.",
    [CustomRuleWarningId.PatternTooLong]:
      "⚠️ This pattern is very long (>200 characters) and may be difficult to maintain. Consider breaking it into multiple simpler rules.",
  };

export function getCustomRuleWarningMessage(id: CustomRuleWarningId): string {
  return CUSTOM_RULE_WARNING_MESSAGES[id];
}
