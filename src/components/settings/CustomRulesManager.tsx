/**
 * @file Custom matching rules management component
 * @module components/settings/CustomRulesManager
 */

import React, { useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  AlertTriangle,
  Info,
  ShieldAlert,
  ChevronDown,
  ExternalLink,
  BookOpen,
} from "lucide-react";

import type {
  CustomRule,
  CustomRulesConfig,
  CustomRuleTarget,
} from "@/utils/storage";
import {
  getMatchConfig,
  saveMatchConfig,
  validateCustomRule,
  migrateCustomRule,
} from "@/utils/storage";
import { clearRegexCache } from "@/api/matching/filtering";
import { debounce } from "@/utils/debounce";
import { useDebugActions } from "@/contexts/DebugContext";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { MetadataFieldSelector } from "./MetadataFieldSelector";
import { RegexDocumentation } from "./RegexDocumentation";

/**
 * Form data for creating/editing custom rules
 */
interface RuleFormData {
  pattern: string;
  description: string;
  caseSensitive: boolean;
  enabled: boolean;
  targetFields: CustomRuleTarget[];
}

/**
 * CustomRulesManager component for managing user-defined matching rules.
 *
 * Provides UI for creating, editing, and deleting custom skip/accept rules.
 * Rules are persisted in MatchConfig storage.
 */
function CustomRulesManagerComponent(): React.JSX.Element {
  const { recordEvent } = useDebugActions();

  const [rules, setRules] = useState<CustomRulesConfig>(() => {
    const config = getMatchConfig();
    const customRules = config.customRules || {
      skipRules: [],
      acceptRules: [],
    };

    // Migrate existing rules to include targetFields if missing
    return {
      skipRules: customRules.skipRules.map((rule) => migrateCustomRule(rule)),
      acceptRules: customRules.acceptRules.map((rule) =>
        migrateCustomRule(rule),
      ),
    };
  });

  const [isAddingRule, setIsAddingRule] = useState<"skip" | "accept" | null>(
    null,
  );
  const [editingRule, setEditingRule] = useState<{
    rule: CustomRule;
    type: "skip" | "accept";
  } | null>(null);
  const [deleteConfirmRule, setDeleteConfirmRule] = useState<{
    rule: CustomRule;
    type: "skip" | "accept";
  } | null>(null);
  const [warningConfirmPending, setWarningConfirmPending] = useState<{
    rule: CustomRule;
    type: "skip" | "accept" | null;
    warning: string;
  } | null>(null);

  const [ruleForm, setRuleForm] = useState<RuleFormData>({
    pattern: "",
    description: "",
    caseSensitive: false,
    enabled: true,
    targetFields: ["titles"],
  });

  const [validationError, setValidationError] = useState<string | null>(null);
  const [testSampleText, setTestSampleText] = useState<string>("");
  const [testResult, setTestResult] = useState<{
    matches: boolean;
    reason?: string;
  } | null>(null);

  // Keep a ref to the cleanup function for debounced validation
  const debouncedValidateRef = React.useRef<
    (((pattern: string) => void) & { cancel(): void }) | null
  >(null);

  /**
   * Validate regex pattern synchronously
   */
  const validatePatternSync = useCallback(
    (pattern: string): boolean => {
      if (!pattern.trim()) {
        setValidationError("Pattern cannot be empty");
        return false;
      }

      try {
        // Use same flags as runtime evaluator: Unicode flag (u) plus case-insensitive flag (i) if needed
        const flags = `u${ruleForm.caseSensitive ? "" : "i"}`;
        new RegExp(pattern, flags);
        setValidationError(null);
        return true;
      } catch (error) {
        setValidationError(
          `Invalid regex pattern: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
        return false;
      }
    },
    [ruleForm.caseSensitive],
  );

  /**
   * Create debounced version of pattern validation (300ms delay)
   * This is called during pattern input to provide real-time feedback without overwhelming
   */
  React.useEffect(() => {
    const debouncedFn = debounce(
      ((pattern: string) => {
        validatePatternSync(pattern);
      }) as (...args: unknown[]) => unknown,
      300,
    ) as ((pattern: string) => void) & { cancel(): void };

    debouncedValidateRef.current = debouncedFn;

    return () => {
      // Cleanup: cancel any pending validations on unmount to avoid late updates
      if (debouncedValidateRef.current) {
        debouncedValidateRef.current.cancel();
      }
      debouncedValidateRef.current = null;
    };
  }, [validatePatternSync]);

  /**
   * Validate regex pattern (debounced during input, immediate during save)
   */
  const validatePattern = useCallback(
    (pattern: string, immediate: boolean = false): boolean => {
      if (immediate) {
        // Immediate validation (used during save)
        return validatePatternSync(pattern);
      }

      // Debounced validation (used during input)
      if (debouncedValidateRef.current) {
        debouncedValidateRef.current(pattern);
      }
      return true; // Always return true for debounced calls as validation happens asynchronously
    },
    [validatePatternSync],
  );

  /**
   * Test pattern against sample text
   */
  const handleTestPattern = useCallback(() => {
    if (!ruleForm.pattern.trim()) {
      setTestResult({ matches: false, reason: "Pattern is empty" });
      return;
    }

    if (!testSampleText.trim()) {
      setTestResult({ matches: false, reason: "Sample text is empty" });
      return;
    }

    try {
      // Include Unicode flag (u) for better international title support
      const flags = `u${ruleForm.caseSensitive ? "" : "i"}`;
      const regex = new RegExp(ruleForm.pattern, flags);
      const matches = regex.test(testSampleText);

      setTestResult({
        matches,
        reason: matches ? "Pattern matches!" : "Pattern does not match",
      });
    } catch (error) {
      setTestResult({
        matches: false,
        reason: `Invalid pattern: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }, [ruleForm.pattern, ruleForm.caseSensitive, testSampleText]);

  /**
   * Handle pattern input change with debounced validation
   */
  const handlePatternChange = useCallback(
    (value: string) => {
      setRuleForm((prev) => ({ ...prev, pattern: value }));
      if (value.trim()) {
        // Use debounced validation (async with 300ms delay)
        validatePattern(value, false);
      } else {
        setValidationError("Pattern cannot be empty");
      }
    },
    [validatePattern],
  );

  /**
   * Open add rule dialog
   */
  const handleAddRule = useCallback((type: "skip" | "accept") => {
    setIsAddingRule(type);
    setRuleForm({
      pattern: "",
      description: "",
      caseSensitive: false,
      enabled: true,
      targetFields: ["titles"],
    });
    setValidationError(null);
  }, []);

  /**
   * Open edit rule dialog
   */
  const handleEditRule = useCallback(
    (rule: CustomRule, type: "skip" | "accept") => {
      setEditingRule({ rule, type });
      setRuleForm({
        pattern: rule.pattern,
        description: rule.description,
        caseSensitive: rule.caseSensitive,
        enabled: rule.enabled,
        targetFields: rule.targetFields,
      });
      setValidationError(null);
    },
    [],
  );

  /**
   * Apply rule mutation to updated rules object (skip or accept).
   * Mutates updatedRules in place for skip/accept arrays.
   */
  const applyRuleMutation = useCallback(
    (
      updatedRules: CustomRulesConfig,
      ruleToValidate: CustomRule,
      type: "skip" | "accept",
      existingRuleId?: string,
    ): void => {
      if (existingRuleId) {
        // Update existing rule - clone array before mutation
        if (type === "skip") {
          const nextSkip = [...updatedRules.skipRules];
          const index = nextSkip.findIndex((r) => r.id === existingRuleId);
          if (index !== -1) {
            nextSkip[index] = ruleToValidate;
          }
          updatedRules.skipRules = nextSkip;
        } else {
          const nextAccept = [...updatedRules.acceptRules];
          const index = nextAccept.findIndex((r) => r.id === existingRuleId);
          if (index !== -1) {
            nextAccept[index] = ruleToValidate;
          }
          updatedRules.acceptRules = nextAccept;
        }
      } else {
        // Add new rule - clone array before mutation
        if (type === "skip") {
          updatedRules.skipRules = [...updatedRules.skipRules, ruleToValidate];
        }
        if (type === "accept") {
          updatedRules.acceptRules = [
            ...updatedRules.acceptRules,
            ruleToValidate,
          ];
        }
      }
    },
    [],
  );

  /**
   * Save rule (add new or update existing)
   */
  const handleSaveRule = useCallback(() => {
    // Validate form
    if (!ruleForm.description.trim()) {
      toast.error("Please provide a description");
      return;
    }

    // Use immediate validation (synchronous, no debounce)
    if (!validatePattern(ruleForm.pattern, true)) {
      toast.error("Please fix the pattern errors");
      return;
    }

    const ruleToValidate: CustomRule = {
      id:
        editingRule?.rule.id ||
        `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      pattern: ruleForm.pattern,
      description: ruleForm.description,
      enabled: ruleForm.enabled,
      caseSensitive: ruleForm.caseSensitive,
      targetFields: ruleForm.targetFields,
      createdAt: editingRule?.rule.createdAt || new Date().toISOString(),
    };

    const validation = validateCustomRule(ruleToValidate);
    if (!validation.valid) {
      toast.error(validation.error || "Invalid rule");
      return;
    }

    // If there's a warning, show confirmation dialog before saving
    if (validation.warning) {
      setWarningConfirmPending({
        rule: ruleToValidate,
        type: editingRule?.type || isAddingRule,
        warning: validation.warning,
      });
      return;
    }

    // No warning, proceed with save
    proceedWithSave(ruleToValidate);
  }, [ruleForm, editingRule, isAddingRule, validatePattern]);

  /**
   * Proceed with saving the rule (called after validation and warning confirmation)
   */
  const proceedWithSave = useCallback(
    (ruleToValidate: CustomRule) => {
      const matchConfig = getMatchConfig();
      const updatedRules = { ...rules };
      const ruleType = editingRule?.type || isAddingRule;

      if (editingRule) {
        applyRuleMutation(
          updatedRules,
          ruleToValidate,
          editingRule.type,
          editingRule.rule.id,
        );
      } else if (ruleType) {
        applyRuleMutation(updatedRules, ruleToValidate, ruleType);
      }

      // Save to storage
      saveMatchConfig({ ...matchConfig, customRules: updatedRules });
      setRules(updatedRules);

      // Clear regex cache to ensure new/updated rules use fresh compiled patterns
      clearRegexCache();

      toast.success(
        editingRule
          ? "Custom rule updated successfully"
          : "Custom rule saved successfully",
      );

      // Log settings update event
      recordEvent({
        type: "settings.match-config-update",
        message: editingRule
          ? `Updated custom ${editingRule.type} rule: ${ruleToValidate.description}`
          : `Added new custom ${ruleType} rule: ${ruleToValidate.description}`,
        level: "info",
        metadata: {
          changed_field: "customRules",
          config: updatedRules,
        },
      });

      // Reset form and close dialog
      setIsAddingRule(null);
      setEditingRule(null);
      setRuleForm({
        pattern: "",
        description: "",
        caseSensitive: false,
        enabled: true,
        targetFields: ["titles"],
      });
      setValidationError(null);
      setWarningConfirmPending(null);
    },
    [editingRule, isAddingRule, rules, recordEvent, applyRuleMutation],
  );

  /**
   * Delete rule with confirmation
   */
  const handleDeleteRule = useCallback(() => {
    if (!deleteConfirmRule) return;

    const matchConfig = getMatchConfig();
    const updatedRules = { ...rules };
    const type = deleteConfirmRule.type;

    if (type === "skip") {
      updatedRules.skipRules = updatedRules.skipRules.filter(
        (r) => r.id !== deleteConfirmRule.rule.id,
      );
    } else {
      updatedRules.acceptRules = updatedRules.acceptRules.filter(
        (r) => r.id !== deleteConfirmRule.rule.id,
      );
    }

    saveMatchConfig({ ...matchConfig, customRules: updatedRules });
    setRules(updatedRules);

    // Clear regex cache to ensure stale patterns are removed
    clearRegexCache();

    toast.success("Custom rule deleted");

    // Log settings update event
    recordEvent({
      type: "settings.match-config-update",
      message: `Deleted custom ${type} rule: ${deleteConfirmRule.rule.description}`,
      level: "info",
      metadata: {
        changed_field: "customRules",
        config: updatedRules,
      },
    });

    setDeleteConfirmRule(null);
  }, [deleteConfirmRule, rules, recordEvent]);

  /**
   * Toggle rule enabled state
   */
  const handleToggleEnabled = useCallback(
    (rule: CustomRule, type: "skip" | "accept", enabled: boolean) => {
      const matchConfig = getMatchConfig();
      const updatedRules = { ...rules };
      const ruleArray =
        type === "skip" ? updatedRules.skipRules : updatedRules.acceptRules;
      const index = ruleArray.findIndex((r) => r.id === rule.id);

      if (index !== -1) {
        // Clone array before mutation to maintain immutability
        const next = [...ruleArray];
        next[index] = { ...next[index], enabled };

        // Assign cloned array back to updatedRules
        if (type === "skip") {
          updatedRules.skipRules = next;
        } else {
          updatedRules.acceptRules = next;
        }

        saveMatchConfig({ ...matchConfig, customRules: updatedRules });
        setRules(updatedRules);
        toast.success(enabled ? "Rule enabled" : "Rule disabled");

        // Log settings update event
        recordEvent({
          type: "settings.match-config-update",
          message: `${enabled ? "Enabled" : "Disabled"} custom ${type} rule: ${rule.description}`,
          level: "info",
          metadata: {
            changed_field: "customRules",
            config: updatedRules,
          },
        });
      }
    },
    [rules, recordEvent],
  );

  /**
   * Render rule table section
   */
  const renderRuleSection = useCallback(
    (
      title: string,
      description: string,
      ruleType: "skip" | "accept",
      ruleArray: CustomRule[],
    ) => (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">{title}</h3>
            <p className="text-muted-foreground text-sm">{description}</p>
          </div>
          <Button
            onClick={() => handleAddRule(ruleType)}
            size="sm"
            variant="outline"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Rule
          </Button>
        </div>

        {ruleArray.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <p className="text-muted-foreground text-sm">
              No custom rules defined. Click &quot;Add Rule&quot; to create one.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Pattern</TableHead>
                  <TableHead className="w-48">Target Fields</TableHead>
                  <TableHead className="w-32">Case Sensitive</TableHead>
                  <TableHead className="w-24">Enabled</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ruleArray.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell className="font-medium">
                      {rule.description}
                    </TableCell>
                    <TableCell>
                      <code className="bg-muted rounded px-2 py-1 font-mono text-xs">
                        {rule.pattern}
                      </code>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {rule.targetFields.slice(0, 3).map((field) => (
                          <Badge
                            key={field}
                            variant="outline"
                            className="text-xs"
                          >
                            {field}
                          </Badge>
                        ))}
                        {rule.targetFields.length > 3 && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge
                                variant="secondary"
                                className="cursor-help text-xs"
                              >
                                +{rule.targetFields.length - 3} more
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="max-w-sm">
                              <p className="mb-1 text-sm font-semibold">
                                All target fields:
                              </p>
                              <p className="text-xs">
                                {rule.targetFields.join(", ")}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={rule.caseSensitive ? "default" : "secondary"}
                      >
                        {rule.caseSensitive ? "Yes" : "No"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={rule.enabled}
                        onCheckedChange={(checked) =>
                          handleToggleEnabled(rule, ruleType, checked)
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleEditRule(rule, ruleType)}
                          size="icon"
                          variant="ghost"
                          aria-label="Edit rule"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          onClick={() =>
                            setDeleteConfirmRule({ rule, type: ruleType })
                          }
                          size="icon"
                          variant="ghost"
                          aria-label="Delete rule"
                        >
                          <Trash2 className="text-destructive h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    ),
    [handleAddRule, handleEditRule, handleToggleEnabled],
  );

  return (
    <Collapsible defaultOpen={false} className="space-y-4">
      <CollapsibleTrigger asChild>
        <Button
          variant="outline"
          className="bg-muted/40 hover:bg-muted/60 w-full justify-between border-2"
        >
          <span className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-500" />
            <span className="text-base font-semibold">
              Advanced: Custom Matching Rules
            </span>
            <Badge variant="destructive" className="ml-2">
              For Advanced Users
            </Badge>
          </span>
          <ChevronDown className="h-4 w-4" />
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="space-y-4">
        {/* Advanced User Warning */}
        <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950">
          <ShieldAlert className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-900 dark:text-amber-100">
            Advanced Feature - Use with Caution
          </AlertTitle>
          <AlertDescription className="space-y-2 text-amber-800 dark:text-amber-200">
            <p>
              Custom matching rules use regular expressions (regex) to filter
              manga. Incorrect patterns can skip desired manga or cause
              performance issues. Only use this feature if you understand regex
              syntax and matching behavior.
            </p>
            <p className="text-xs">
              <a
                href="https://developer.mozilla.org/docs/Web/JavaScript/Guide/Regular_expressions"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 underline hover:text-amber-900 dark:hover:text-amber-100"
              >
                Learn about regex patterns
                <ExternalLink className="h-3 w-3" />
              </a>
            </p>
          </AlertDescription>
        </Alert>

        <div className="bg-muted/40 space-y-6 rounded-xl border p-4">
          <div>
            <h2 className="text-xl font-semibold">Custom Matching Rules</h2>
            <p className="text-muted-foreground text-sm">
              Define regex patterns to automatically skip or accept manga during
              matching
            </p>
          </div>

          {renderRuleSection(
            "Skip Rules",
            "Automatically exclude manga from matching results",
            "skip",
            rules.skipRules,
          )}

          {renderRuleSection(
            "Accept Rules",
            "Automatically boost confidence for matching results",
            "accept",
            rules.acceptRules,
          )}
        </div>
      </CollapsibleContent>

      {/* Add/Edit Rule Dialog */}
      <Dialog
        open={isAddingRule !== null || editingRule !== null}
        onOpenChange={(open) => {
          if (!open) {
            setIsAddingRule(null);
            setEditingRule(null);
            setValidationError(null);
          }
        }}
      >
        <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>
              {(() => {
                if (editingRule) return "Edit Custom Rule";
                const ruleType = isAddingRule === "skip" ? "Skip" : "Accept";
                return `Add ${ruleType} Rule`;
              })()}
            </DialogTitle>
            <DialogDescription>
              Define a regex pattern to match against selected metadata fields.
              A match occurs if the pattern matches ANY of the selected fields.
              Supported fields: titles, author, genres, tags, format, country of
              origin, source, description, and status.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 space-y-4 overflow-y-auto pr-4">
            <div className="space-y-2">
              <label htmlFor="description" className="text-sm font-medium">
                Description
              </label>
              <Input
                id="description"
                placeholder="e.g., Skip anthology collections"
                value={ruleForm.description}
                onChange={(e) =>
                  setRuleForm((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                maxLength={100}
              />
              <p className="text-muted-foreground text-xs">
                User-friendly label to identify this rule
              </p>
            </div>

            {/* Metadata Field Selector */}
            <MetadataFieldSelector
              selectedFields={ruleForm.targetFields}
              onChange={(fields) =>
                setRuleForm((prev) => ({ ...prev, targetFields: fields }))
              }
            />

            <div className="space-y-2">
              <label htmlFor="pattern" className="text-sm font-medium">
                Pattern (Regex)
              </label>
              <Textarea
                id="pattern"
                placeholder="e.g., anthology or ^one.?shot$ or (vol|volume)\s*\d+"
                value={ruleForm.pattern}
                onChange={(e) => handlePatternChange(e.target.value)}
                className="font-mono text-sm"
                rows={3}
              />
              {validationError && (
                <div className="text-destructive flex items-center gap-2 text-xs">
                  <AlertTriangle className="h-3 w-3" />
                  {validationError}
                </div>
              )}
              <p className="text-muted-foreground text-xs">
                Examples:{" "}
                <code className="bg-muted rounded px-1">anthology</code>,{" "}
                <code className="bg-muted rounded px-1">^one.?shot$</code>,{" "}
                <code className="bg-muted rounded px-1">
                  (vol|volume)\s*\d+
                </code>
              </p>
              <p className="text-muted-foreground text-xs">
                Note: Patterns use Unicode matching (u flag) to better support
                international characters in titles. When not case-sensitive,
                patterns are combined with the case-insensitive flag (i).
              </p>
            </div>

            {/* Regex Documentation */}
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-between"
                  type="button"
                >
                  <span className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    Regex Pattern Guide
                  </span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <RegexDocumentation />
              </CollapsibleContent>
            </Collapsible>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <label htmlFor="case-sensitive" className="text-sm font-medium">
                  Case Sensitive
                </label>
                <p className="text-muted-foreground text-xs">
                  Match pattern with exact case (default: case-insensitive)
                </p>
              </div>
              <Switch
                id="case-sensitive"
                checked={ruleForm.caseSensitive}
                onCheckedChange={(checked) =>
                  setRuleForm((prev) => ({ ...prev, caseSensitive: checked }))
                }
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <label htmlFor="enabled" className="text-sm font-medium">
                  Enabled
                </label>
                <p className="text-muted-foreground text-xs">
                  Activate this rule for matching operations
                </p>
              </div>
              <Switch
                id="enabled"
                checked={ruleForm.enabled}
                onCheckedChange={(checked) =>
                  setRuleForm((prev) => ({ ...prev, enabled: checked }))
                }
              />
            </div>

            {/* Pattern Tester */}
            <div className="space-y-2 rounded-lg border p-3">
              <label htmlFor="test-sample" className="text-sm font-medium">
                Test Pattern
              </label>
              <Textarea
                id="test-sample"
                placeholder="Enter sample title to test against (e.g., 'Naruto: Shippuden', 'One-Shot Collection')"
                value={testSampleText}
                onChange={(e) => {
                  setTestSampleText(e.target.value);
                  setTestResult(null);
                }}
                className="min-h-20 font-mono text-xs"
              />
              <div className="flex gap-2">
                <Button
                  onClick={handleTestPattern}
                  size="sm"
                  variant="secondary"
                  disabled={!ruleForm.pattern.trim() || !testSampleText.trim()}
                  className="flex-1"
                >
                  Test Pattern
                </Button>
                {testResult && (
                  <div
                    className={`flex flex-1 items-center gap-2 rounded px-3 py-2 text-xs font-medium ${
                      testResult.matches
                        ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                        : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                    }`}
                  >
                    {testResult.matches ? "✓ Match" : "✗ No match"}
                  </div>
                )}
              </div>
              {testResult && (
                <p className="text-muted-foreground text-xs">
                  {testResult.reason}
                </p>
              )}
              <p className="text-muted-foreground text-xs">
                Try different sample titles to verify your pattern works as
                expected
              </p>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Skip rules only apply to automatic matching and are ignored
                during manual searches. Accept rules also require automatic
                matching context (kenmeiManga data) to apply.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter className="mt-4 shrink-0 border-t pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setIsAddingRule(null);
                setEditingRule(null);
                setValidationError(null);
              }}
            >
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            <Button
              onClick={handleSaveRule}
              disabled={
                !!validationError ||
                !ruleForm.description.trim() ||
                ruleForm.targetFields.length === 0
              }
              aria-disabled={
                !!validationError ||
                !ruleForm.description.trim() ||
                ruleForm.targetFields.length === 0
              }
            >
              <Check className="mr-2 h-4 w-4" />
              Save Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={deleteConfirmRule !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirmRule(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Custom Rule?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;
              {deleteConfirmRule?.rule.description}&quot;? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRule}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Warning Confirmation Dialog */}
      <AlertDialog
        open={warningConfirmPending !== null}
        onOpenChange={(open) => {
          if (!open) setWarningConfirmPending(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Broad Pattern</AlertDialogTitle>
            <AlertDialogDescription>
              {warningConfirmPending?.warning}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (warningConfirmPending?.rule) {
                  proceedWithSave(warningConfirmPending.rule);
                }
              }}
            >
              Save Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Collapsible>
  );
}

/**
 * Memoized CustomRulesManager component
 */
export const CustomRulesManager = React.memo(CustomRulesManagerComponent);
