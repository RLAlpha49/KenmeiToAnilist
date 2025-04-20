import React from "react";
import { SyncReport } from "../../api/anilist/sync-service";
import { CheckCircle, XCircle, Clock, Save, Download } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { Button } from "../ui/button";

interface SyncResultsViewProps {
  report: SyncReport;
  onClose: () => void;
  onExportErrors?: () => void;
}

const SyncResultsView: React.FC<SyncResultsViewProps> = ({
  report,
  onClose,
  onExportErrors,
}) => {
  // Format timestamp to readable format
  const formattedTime = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(report.timestamp);

  // Calculate success percentage
  const successRate =
    report.totalEntries > 0
      ? Math.round((report.successfulUpdates / report.totalEntries) * 100)
      : 0;

  // Handle export of error log
  const handleExportErrors = () => {
    if (!report.errors.length || !onExportErrors) return;
    onExportErrors();
  };

  return (
    <Card className="mx-auto w-full max-w-3xl">
      <CardHeader>
        <CardTitle>Synchronization Results</CardTitle>
        <CardDescription>Completed at {formattedTime}</CardDescription>
      </CardHeader>

      <CardContent>
        {/* Summary statistics */}
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="flex flex-col items-center justify-center rounded-md bg-green-50 p-4 dark:bg-green-900/20">
            <CheckCircle className="mb-2 h-8 w-8 text-green-500" />
            <span className="text-2xl font-bold">
              {report.successfulUpdates}
            </span>
            <span className="text-sm">Successful Updates</span>
          </div>

          <div className="flex flex-col items-center justify-center rounded-md bg-red-50 p-4 dark:bg-red-900/20">
            <XCircle className="mb-2 h-8 w-8 text-red-500" />
            <span className="text-2xl font-bold">{report.failedUpdates}</span>
            <span className="text-sm">Failed Updates</span>
          </div>

          <div className="flex flex-col items-center justify-center rounded-md bg-yellow-50 p-4 dark:bg-yellow-900/20">
            <Clock className="mb-2 h-8 w-8 text-yellow-500" />
            <span className="text-2xl font-bold">{report.skippedEntries}</span>
            <span className="text-sm">Skipped Entries</span>
          </div>

          <div className="flex flex-col items-center justify-center rounded-md bg-blue-50 p-4 dark:bg-blue-900/20">
            <Save className="mb-2 h-8 w-8 text-blue-500" />
            <span className="text-2xl font-bold">{successRate}%</span>
            <span className="text-sm">Success Rate</span>
          </div>
        </div>

        {/* Progress bar representing overall success */}
        <div className="mb-6">
          <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-emerald-500"
              style={{ width: `${successRate}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-xs text-gray-500">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>

        {/* Error details */}
        {report.errors.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-2 flex items-center text-sm font-medium">
              <XCircle className="mr-1 h-4 w-4 text-red-500" />
              Failed Updates ({report.errors.length})
            </h3>

            <div className="overflow-hidden rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Media ID</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.errors.slice(0, 10).map((error, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">
                        {error.mediaId}
                      </TableCell>
                      <TableCell>{error.error}</TableCell>
                    </TableRow>
                  ))}
                  {report.errors.length > 10 && (
                    <TableRow>
                      <TableCell
                        colSpan={2}
                        className="text-center text-sm text-gray-500"
                      >
                        ... and {report.errors.length - 10} more errors
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex justify-between">
        <div>
          {report.errors.length > 0 && onExportErrors && (
            <Button variant="outline" onClick={handleExportErrors}>
              <Download className="mr-2 h-4 w-4" />
              Export Error Log
            </Button>
          )}
        </div>

        <Button onClick={onClose}>Close</Button>
      </CardFooter>
    </Card>
  );
};

export default SyncResultsView;
