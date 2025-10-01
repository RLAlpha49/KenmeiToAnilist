import React, { Dispatch, SetStateAction } from "react";
import { Filter } from "lucide-react";
import { Card, CardContent } from "../../ui/card";
import { Checkbox } from "../../ui/checkbox";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Separator } from "../../ui/separator";

export interface StatusFiltersState {
  matched: boolean;
  pending: boolean;
  manual: boolean;
  skipped: boolean;
}

export interface MatchFilterStats {
  matched: number;
  pending: number;
  manual: number;
  skipped: number;
}

export interface MatchFilterControlsProps {
  statusFilters: StatusFiltersState;
  setStatusFilters: Dispatch<SetStateAction<StatusFiltersState>>;
  matchStats: MatchFilterStats;
}

export function MatchFilterControls({
  statusFilters,
  setStatusFilters,
  matchStats,
}: Readonly<MatchFilterControlsProps>) {
  return (
    <Card className="mb-4">
      <CardContent className="p-4">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="flex items-center gap-2">
            <Filter className="text-muted-foreground h-4 w-4" />
            <span className="text-sm font-medium">Show status:</span>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="matched-filter"
                checked={statusFilters.matched}
                onCheckedChange={() =>
                  setStatusFilters({
                    ...statusFilters,
                    matched: !statusFilters.matched,
                  })
                }
              />
              <label
                htmlFor="matched-filter"
                className="flex items-center text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Matched
                <Badge
                  variant="outline"
                  className="ml-2 bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400"
                >
                  {matchStats.matched}
                </Badge>
              </label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="pending-filter"
                checked={statusFilters.pending}
                onCheckedChange={() =>
                  setStatusFilters({
                    ...statusFilters,
                    pending: !statusFilters.pending,
                  })
                }
              />
              <label
                htmlFor="pending-filter"
                className="flex items-center text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Pending
                <Badge
                  variant="outline"
                  className="bg-muted/80 text-foreground ml-2"
                >
                  {matchStats.pending}
                </Badge>
              </label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="manual-filter"
                checked={statusFilters.manual}
                onCheckedChange={() =>
                  setStatusFilters({
                    ...statusFilters,
                    manual: !statusFilters.manual,
                  })
                }
              />
              <label
                htmlFor="manual-filter"
                className="flex items-center text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Manual
                <Badge
                  variant="outline"
                  className="ml-2 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                >
                  {matchStats.manual}
                </Badge>
              </label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="skipped-filter"
                checked={statusFilters.skipped}
                onCheckedChange={() =>
                  setStatusFilters({
                    ...statusFilters,
                    skipped: !statusFilters.skipped,
                  })
                }
              />
              <label
                htmlFor="skipped-filter"
                className="flex items-center text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Skipped
                <Badge
                  variant="outline"
                  className="ml-2 bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400"
                >
                  {matchStats.skipped}
                </Badge>
              </label>
            </div>

            <div className="ml-2 flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setStatusFilters({
                    matched: true,
                    pending: true,
                    manual: true,
                    skipped: true,
                  })
                }
                className="h-7 px-2 text-xs"
              >
                Select All
              </Button>
              <Separator orientation="vertical" className="h-4" />
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setStatusFilters({
                    matched: false,
                    pending: false,
                    manual: false,
                    skipped: false,
                  })
                }
                className="h-7 px-2 text-xs"
              >
                Clear All
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
