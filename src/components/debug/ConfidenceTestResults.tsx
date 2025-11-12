import React from "react";
import { AlertTriangle, Check, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { MangaMatch } from "@/api/anilist/types";

interface ConfidenceBracket {
  minConfidence: number;
  maxConfidence: number;
  label: string;
  className: string;
}

const CONFIDENCE_BRACKETS: ConfidenceBracket[] = [
  {
    minConfidence: 90,
    maxConfidence: 100,
    label: "Near-perfect match",
    className:
      "bg-emerald-100 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-100",
  },
  {
    minConfidence: 80,
    maxConfidence: 89,
    label: "Strong match",
    className: "bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100",
  },
  {
    minConfidence: 65,
    maxConfidence: 79,
    label: "Good match",
    className: "bg-cyan-100 dark:bg-cyan-900 text-cyan-900 dark:text-cyan-100",
  },
  {
    minConfidence: 50,
    maxConfidence: 64,
    label: "Reasonable match",
    className:
      "bg-yellow-100 dark:bg-yellow-900 text-yellow-900 dark:text-yellow-100",
  },
  {
    minConfidence: 30,
    maxConfidence: 49,
    label: "Weak match",
    className:
      "bg-orange-100 dark:bg-orange-900 text-orange-900 dark:text-orange-100",
  },
  {
    minConfidence: 15,
    maxConfidence: 29,
    label: "Very weak match",
    className: "bg-red-100 dark:bg-red-900 text-red-900 dark:text-red-100",
  },
  {
    minConfidence: 1,
    maxConfidence: 14,
    label: "Extremely weak match",
    className: "bg-red-200 dark:bg-red-950 text-red-950 dark:text-red-200",
  },
];

interface ConfidenceTestResultsProps {
  readonly match: MangaMatch;
  readonly searchTitle: string;
  readonly candidateTitle: string;
  readonly candidateRomaji?: string;
  readonly candidateNative?: string;
}

export function ConfidenceTestResults({
  match,
  searchTitle,
  candidateTitle,
  candidateRomaji = "",
  candidateNative = "",
}: Readonly<ConfidenceTestResultsProps>): React.ReactNode {
  const confidence = Math.round(match.confidence);

  // Find which bracket this confidence falls into
  const currentBracket = CONFIDENCE_BRACKETS.find(
    (bracket) =>
      confidence >= bracket.minConfidence &&
      confidence <= bracket.maxConfidence,
  );

  const getConfidenceColor = (conf: number): string => {
    if (conf >= 90) return "text-emerald-600 dark:text-emerald-400";
    if (conf >= 80) return "text-blue-600 dark:text-blue-400";
    if (conf >= 65) return "text-cyan-600 dark:text-cyan-400";
    if (conf >= 50) return "text-yellow-600 dark:text-yellow-400";
    if (conf >= 30) return "text-orange-600 dark:text-orange-400";
    if (conf >= 15) return "text-red-600 dark:text-red-400";
    return "text-red-700 dark:text-red-300";
  };

  return (
    <div className="space-y-4">
      {/* Input Titles Section */}
      <Card className="bg-slate-50 p-4 dark:bg-slate-900">
        <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
          Input Titles
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600 dark:text-slate-400">
              Search Title:
            </span>
            <span className="font-medium text-slate-900 dark:text-slate-100">
              {searchTitle}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600 dark:text-slate-400">
              Candidate Title:
            </span>
            <span className="font-medium text-slate-900 dark:text-slate-100">
              {candidateTitle}
            </span>
          </div>
          {candidateRomaji && (
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">
                Romaji:
              </span>
              <span className="font-medium text-slate-900 dark:text-slate-100">
                {candidateRomaji}
              </span>
            </div>
          )}
          {candidateNative && (
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">
                Native:
              </span>
              <span className="font-medium text-slate-900 dark:text-slate-100">
                {candidateNative}
              </span>
            </div>
          )}
        </div>
      </Card>

      <Separator />

      {/* Match Score Section */}
      <Card className="bg-slate-50 p-4 dark:bg-slate-900">
        <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
          Match Results
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600 dark:text-slate-400">
              Match Score:
            </span>
            <code className="rounded bg-slate-100 px-2 py-1 font-mono text-sm dark:bg-slate-800">
              {(match.confidence / 100).toFixed(4)} (0-1 scale)
            </code>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600 dark:text-slate-400">
              Confidence:
            </span>
            <span
              className={`text-lg font-bold ${getConfidenceColor(confidence)}`}
            >
              {confidence}%
            </span>
          </div>
          {currentBracket && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600 dark:text-slate-400">
                Confidence Level:
              </span>
              <Badge className={currentBracket.className}>
                {currentBracket.label}
              </Badge>
            </div>
          )}
        </div>
      </Card>

      <Separator />

      {/* Confidence Brackets Section */}
      <Card className="bg-slate-50 p-4 dark:bg-slate-900">
        <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
          Confidence Brackets
        </h3>
        <div className="space-y-2">
          {CONFIDENCE_BRACKETS.map((bracket) => {
            const isMatched =
              confidence >= bracket.minConfidence &&
              confidence <= bracket.maxConfidence;
            return (
              <div
                key={bracket.label}
                className="flex items-center gap-2 text-sm"
              >
                <div
                  className={`flex h-5 w-5 items-center justify-center rounded ${bracket.className}`}
                >
                  {isMatched ? (
                    <Check className="h-3 w-3 font-bold" />
                  ) : (
                    <X className="h-3 w-3 opacity-30" />
                  )}
                </div>
                <span className="flex-1 text-slate-700 dark:text-slate-300">
                  {bracket.minConfidence}
                  {bracket.minConfidence === bracket.maxConfidence
                    ? ""
                    : `–${bracket.maxConfidence}`}
                  %: {bracket.label}
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Info Alert */}
      <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <p>
          This is a test calculation. Run the actual CLI command to see detailed
          scoring breakdown.
        </p>
      </div>
    </div>
  );
}
