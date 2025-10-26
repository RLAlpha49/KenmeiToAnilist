/**
 * Comprehensive regex documentation component for custom matching rules.
 *
 * Provides detailed guidance on regex syntax, safe patterns, dangerous patterns,
 * and security considerations including ReDoS vulnerabilities.
 *
 * @module RegexDocumentation
 */

import React, { memo } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BookOpen,
  ChevronDown,
  ShieldAlert,
  ExternalLink,
  CheckCircle2,
  XCircle,
} from "lucide-react";

/**
 * Regex documentation component with comprehensive guides and examples.
 *
 * @returns Rendered regex documentation
 */
function RegexDocumentationComponent() {
  return (
    <div className="space-y-4">
      {/* Security Warning - Always Visible */}
      <Alert variant="destructive">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Security Warning - ReDoS Vulnerability</AlertTitle>
        <AlertDescription className="space-y-2">
          <p>
            Certain regex patterns can cause catastrophic backtracking, making
            the application freeze or crash when matching against long strings.
            The application validates patterns to detect these issues, but
            always test your patterns thoroughly.
          </p>
          <p className="text-xs">
            <a
              href="https://owasp.org/www-community/attacks/Regular_expression_Denial_of_Service_-_ReDoS"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-destructive-foreground inline-flex items-center gap-1 underline"
            >
              Learn more about ReDoS
              <ExternalLink className="h-3 w-3" />
            </a>
          </p>
        </AlertDescription>
      </Alert>

      {/* Safe Pattern Examples - Always Visible */}
      <div className="space-y-2">
        <h4 className="flex items-center gap-2 text-sm font-semibold">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          Safe Pattern Examples
        </h4>
        <div className="space-y-2 text-xs">
          <div className="flex gap-2">
            <code className="bg-muted flex-1 rounded px-2 py-1 font-mono">
              ^one.?shot$
            </code>
            <span className="text-muted-foreground flex-1">
              Matches &quot;one shot&quot; or &quot;one-shot&quot; (bounded)
            </span>
          </div>
          <div className="flex gap-2">
            <code className="bg-muted flex-1 rounded px-2 py-1 font-mono">
              \b(vol|volume)\s*\d{"{1,3}"}\b
            </code>
            <span className="text-muted-foreground flex-1">
              Matches &quot;vol 1&quot; to &quot;volume 999&quot; (bounded)
            </span>
          </div>
          <div className="flex gap-2">
            <code className="bg-muted flex-1 rounded px-2 py-1 font-mono">
              ^[a-z]{"{3,50}"}$
            </code>
            <span className="text-muted-foreground flex-1">
              Matches 3-50 lowercase letters (bounded)
            </span>
          </div>
          <div className="flex gap-2">
            <code className="bg-muted flex-1 rounded px-2 py-1 font-mono">
              anthology|collection
            </code>
            <span className="text-muted-foreground flex-1">
              Simple alternation (no quantifiers)
            </span>
          </div>
          <div className="flex gap-2">
            <code className="bg-muted flex-1 rounded px-2 py-1 font-mono">
              ^official.*translation$
            </code>
            <span className="text-muted-foreground flex-1">
              Anchored with specific start/end
            </span>
          </div>
        </div>
      </div>

      {/* Dangerous Patterns - Always Visible */}
      <div className="space-y-2">
        <h4 className="flex items-center gap-2 text-sm font-semibold">
          <XCircle className="text-destructive h-4 w-4" />
          Dangerous Patterns to Avoid
        </h4>
        <div className="space-y-2 text-xs">
          <div className="flex items-start gap-2">
            <Badge variant="destructive" className="shrink-0">
              ❌
            </Badge>
            <div className="flex-1">
              <code className="bg-muted rounded px-2 py-1 font-mono">
                (a+)+
              </code>
              <p className="text-muted-foreground mt-1">
                Nested quantifiers cause exponential backtracking (ReDoS)
              </p>
              <p className="mt-1 text-green-600">
                ✅ Alternative:{" "}
                <code className="bg-muted rounded px-1 font-mono">a+</code> or{" "}
                <code className="bg-muted rounded px-1 font-mono">
                  a{"{1,100}"}
                </code>
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Badge variant="destructive" className="shrink-0">
              ❌
            </Badge>
            <div className="flex-1">
              <code className="bg-muted rounded px-2 py-1 font-mono">
                (a|aa)+
              </code>
              <p className="text-muted-foreground mt-1">
                Overlapping alternations cause exponential backtracking
              </p>
              <p className="mt-1 text-green-600">
                ✅ Alternative:{" "}
                <code className="bg-muted rounded px-1 font-mono">a+</code>
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Badge variant="destructive" className="shrink-0">
              ❌
            </Badge>
            <div className="flex-1">
              <code className="bg-muted rounded px-2 py-1 font-mono">
                ^(.*a)*$
              </code>
              <p className="text-muted-foreground mt-1">
                Catastrophic pattern causes performance issues
              </p>
              <p className="mt-1 text-green-600">
                ✅ Alternative:{" "}
                <code className="bg-muted rounded px-1 font-mono">
                  ^(?:[^a]*a)+$
                </code>{" "}
                or avoid entirely
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Badge variant="destructive" className="shrink-0">
              ❌
            </Badge>
            <div className="flex-1">
              <code className="bg-muted rounded px-2 py-1 font-mono">.*</code>
              <p className="text-muted-foreground mt-1">
                Unbounded wildcard matches everything (too broad)
              </p>
              <p className="mt-1 text-green-600">
                ✅ Alternative: Use anchors{" "}
                <code className="bg-muted rounded px-1 font-mono">
                  ^.*something$
                </code>{" "}
                or bounds{" "}
                <code className="bg-muted rounded px-1 font-mono">
                  .{"{0,100}"}
                </code>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Basic Syntax - Collapsible */}
      <Collapsible defaultOpen={true}>
        <CollapsibleTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-between"
            type="button"
          >
            <span className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Basic Syntax
            </span>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-1/3">Pattern</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-mono">anthology</TableCell>
                <TableCell>
                  Matches the word &quot;anthology&quot; anywhere
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-mono">^one shot</TableCell>
                <TableCell>
                  Matches text starting with &quot;one shot&quot;
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-mono">anthology$</TableCell>
                <TableCell>
                  Matches text ending with &quot;anthology&quot;
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-mono">^exact match$</TableCell>
                <TableCell>Matches only &quot;exact match&quot;</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-mono">\bvol\b</TableCell>
                <TableCell>
                  Matches &quot;vol&quot; as a complete word
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-mono">.</TableCell>
                <TableCell>
                  Matches any single character (use sparingly)
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-mono">\. \* \+ \?</TableCell>
                <TableCell>
                  Escape special characters to match literals
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CollapsibleContent>
      </Collapsible>

      {/* Quantifiers - Collapsible */}
      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-between"
            type="button"
          >
            <span className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Quantifiers (Repetition)
            </span>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-1/3">Pattern</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-mono">colou?r</TableCell>
                <TableCell>
                  Matches &quot;color&quot; or &quot;colour&quot; (zero or one)
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-mono">\d*</TableCell>
                <TableCell>
                  Matches zero or more digits (use with caution)
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-mono">\d+</TableCell>
                <TableCell>Matches one or more digits</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-mono">\d{"{4}"}</TableCell>
                <TableCell>Matches exactly 4 digits</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-mono">\d{"{2,4}"}</TableCell>
                <TableCell>Matches 2 to 4 digits</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-mono">\w{"{3,20}"}</TableCell>
                <TableCell>
                  Matches 3-20 word characters (always prefer bounds for safety)
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CollapsibleContent>
      </Collapsible>

      {/* Character Classes - Collapsible */}
      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-between"
            type="button"
          >
            <span className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Character Classes
            </span>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-1/3">Pattern</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-mono">\d or [0-9]</TableCell>
                <TableCell>Matches any digit</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-mono">\w or [a-zA-Z0-9_]</TableCell>
                <TableCell>Matches letters, digits, underscore</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-mono">\s</TableCell>
                <TableCell>Matches whitespace (space, tab, newline)</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-mono">[abc]</TableCell>
                <TableCell>Matches a, b, or c</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-mono">[^abc]</TableCell>
                <TableCell>Matches anything except a, b, or c</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-mono">[a-z] [A-Z] [0-9]</TableCell>
                <TableCell>Matches character ranges</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CollapsibleContent>
      </Collapsible>

      {/* Grouping and Alternation - Collapsible */}
      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-between"
            type="button"
          >
            <span className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Grouping and Alternation
            </span>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-1/3">Pattern</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-mono">manga|manhwa|manhua</TableCell>
                <TableCell>Matches any of the options</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-mono">(one|two) shot</TableCell>
                <TableCell>
                  Matches &quot;one shot&quot; or &quot;two shot&quot;
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-mono">(?:pattern)</TableCell>
                <TableCell>
                  Non-capturing group (better performance, use when you
                  don&apos;t need to capture)
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CollapsibleContent>
      </Collapsible>

      {/* External Resources - Always Visible */}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold">External Resources</h4>
        <div className="flex flex-col gap-2 text-xs">
          <a
            href="https://developer.mozilla.org/docs/Web/JavaScript/Guide/Regular_expressions"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary inline-flex items-center gap-2 hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            MDN RegExp Guide - Complete JavaScript regex tutorial
          </a>
          <a
            href="https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/RegExp"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary inline-flex items-center gap-2 hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            MDN RegExp Reference - Full API reference
          </a>
          <a
            href="https://regex101.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary inline-flex items-center gap-2 hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            Regex101 - Interactive regex tester (use JavaScript flavor)
          </a>
          <a
            href="https://regexr.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary inline-flex items-center gap-2 hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            RegExr - Another excellent regex testing tool
          </a>
        </div>
      </div>
    </div>
  );
}

/**
 * Memoized regex documentation component for performance.
 */
export const RegexDocumentation = memo(RegexDocumentationComponent);
