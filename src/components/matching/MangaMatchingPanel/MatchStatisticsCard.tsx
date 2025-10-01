import React from "react";
import { Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Badge } from "../../ui/badge";
import { Input } from "../../ui/input";

export interface MatchStatisticsCardProps {
  matchStats: {
    total: number;
    matched: number;
    pending: number;
    manual: number;
    skipped: number;
  };
  noMatchesCount: number;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
}

export function MatchStatisticsCard({
  matchStats,
  noMatchesCount,
  searchTerm,
  onSearchTermChange,
  searchInputRef,
}: Readonly<MatchStatisticsCardProps>) {
  return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold">
          Match Statistics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-wrap gap-3">
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="bg-muted/50 text-foreground">
              Total: {matchStats.total}
            </Badge>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="bg-muted/80 text-foreground">
              Pending: {matchStats.pending}
            </Badge>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge
              variant="outline"
              className="bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400"
            >
              Matched: {matchStats.matched}
            </Badge>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge
              variant="outline"
              className="bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
            >
              Manual: {matchStats.manual}
            </Badge>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge
              variant="outline"
              className="bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400"
            >
              Skipped: {matchStats.skipped}
            </Badge>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge
              variant="outline"
              className="bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400"
            >
              No Matches: {noMatchesCount}
            </Badge>
          </div>
        </div>

        <div className="relative mb-6">
          <div className="relative">
            <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
            <Input
              ref={searchInputRef}
              type="text"
              className="pl-9"
              placeholder="Search titles... (Ctrl+F)"
              value={searchTerm}
              onChange={(event) => onSearchTermChange(event.target.value)}
              aria-label="Search manga titles"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
