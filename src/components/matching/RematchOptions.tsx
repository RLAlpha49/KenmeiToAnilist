import React from "react";
import { StatusFilterOptions } from "../../types/matching";
import { MangaMatchResult } from "../../api/anilist/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Checkbox } from "../../components/ui/checkbox";
import { Alert, AlertTitle, AlertDescription } from "../../components/ui/alert";
import { RefreshCw, AlertTriangle, RotateCcw, X } from "lucide-react";
import { motion } from "framer-motion";

interface RematchOptionsProps {
  selectedStatuses: StatusFilterOptions;
  onChangeSelectedStatuses: (statuses: StatusFilterOptions) => void;
  matchResults: MangaMatchResult[];
  rematchWarning: string | null;
  onRematchByStatus: () => void;
  onCloseOptions: () => void;
}

export const RematchOptions: React.FC<RematchOptionsProps> = ({
  selectedStatuses,
  onChangeSelectedStatuses,
  matchResults,
  rematchWarning,
  onRematchByStatus,
  onCloseOptions,
}) => {
  const toggleStatus = (status: keyof StatusFilterOptions) => {
    onChangeSelectedStatuses({
      ...selectedStatuses,
      [status]: !selectedStatuses[status],
    });
  };

  const resetToDefault = () => {
    onChangeSelectedStatuses({
      ...selectedStatuses,
      pending: true,
      skipped: true,
      matched: false,
      manual: false,
    });
  };

  // Calculate the total count of manga to be rematched
  const calculateTotalCount = () => {
    return Object.entries(selectedStatuses)
      .filter(([, selected]) => selected)
      .reduce((count, [status]) => {
        return count + matchResults.filter((m) => m.status === status).length;
      }, 0);
  };

  // Calculate individual counts for status badges
  const statusCounts = {
    pending: matchResults.filter((m) => m.status === "pending").length,
    skipped: matchResults.filter((m) => m.status === "skipped").length,
    matched: matchResults.filter((m) => m.status === "matched").length,
    manual: matchResults.filter((m) => m.status === "manual").length,
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="mb-6 flex flex-col overflow-hidden border-blue-100 pt-0 pb-0 shadow-md dark:border-blue-900">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 pt-2 pb-2 dark:from-blue-950/40 dark:to-indigo-950/40">
          <div className="flex flex-wrap items-center justify-between">
            <CardTitle className="text-lg">Rematch Options</CardTitle>
            <Button
              variant="outline"
              size="icon"
              onClick={onCloseOptions}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 p-6 pb-3">
          {rematchWarning && (
            <Alert
              variant="default"
              className="border-yellow-200 bg-yellow-50 dark:border-yellow-900/50 dark:bg-yellow-900/20"
            >
              <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
              <AlertTitle className="text-yellow-800 dark:text-yellow-400">
                Warning
              </AlertTitle>
              <AlertDescription className="text-yellow-700 dark:text-yellow-300">
                {rematchWarning}
              </AlertDescription>
            </Alert>
          )}

          <div>
            <h3 className="mb-3 text-sm font-medium">
              Select which manga statuses to rematch
            </h3>
            <div className="bg-muted/40 grid grid-cols-1 gap-3 rounded-md p-4 sm:grid-cols-2 md:grid-cols-2">
              <div className="bg-background flex items-center space-x-2 rounded-md p-3 shadow-sm">
                <Checkbox
                  id="pending"
                  checked={selectedStatuses.pending}
                  onCheckedChange={() => toggleStatus("pending")}
                />
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="pending"
                    className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Pending
                  </label>
                  <Badge
                    variant="secondary"
                    className="bg-muted/80 text-foreground ml-1"
                  >
                    {statusCounts.pending}
                  </Badge>
                </div>
              </div>

              <div className="bg-background flex items-center space-x-2 rounded-md p-3 shadow-sm">
                <Checkbox
                  id="matched"
                  checked={selectedStatuses.matched}
                  onCheckedChange={() => toggleStatus("matched")}
                />
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="matched"
                    className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Matched
                  </label>
                  <Badge
                    variant="secondary"
                    className="ml-1 bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400"
                  >
                    {statusCounts.matched}
                  </Badge>
                </div>
              </div>

              <div className="bg-background flex items-center space-x-2 rounded-md p-3 shadow-sm">
                <Checkbox
                  id="manual"
                  checked={selectedStatuses.manual}
                  onCheckedChange={() => toggleStatus("manual")}
                />
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="manual"
                    className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Manual
                  </label>
                  <Badge
                    variant="secondary"
                    className="ml-1 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                  >
                    {statusCounts.manual}
                  </Badge>
                </div>
              </div>

              <div className="bg-background flex items-center space-x-2 rounded-md p-3 shadow-sm">
                <Checkbox
                  id="skipped"
                  checked={selectedStatuses.skipped}
                  onCheckedChange={() => toggleStatus("skipped")}
                />
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="skipped"
                    className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Skipped
                  </label>
                  <Badge
                    variant="secondary"
                    className="ml-1 bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400"
                  >
                    {statusCounts.skipped}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between rounded-md bg-blue-50/50 p-4 dark:bg-blue-900/20">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                Total:{" "}
                <Badge variant="secondary" className="ml-1">
                  {calculateTotalCount()}
                </Badge>{" "}
                manga to rematch
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={resetToDefault}
              className="h-8"
            >
              <RotateCcw className="mr-2 h-3 w-3" />
              Reset
            </Button>
          </div>
        </CardContent>

        <CardFooter className="flex justify-end border-t p-4 pt-0">
          <Button
            variant="default"
            onClick={onRematchByStatus}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            disabled={calculateTotalCount() === 0}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Fresh Search Selected ({calculateTotalCount()})
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  );
};
