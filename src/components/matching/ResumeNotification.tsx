import React from "react";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { AlertTriangle, Play, XCircle } from "lucide-react";

interface ResumeNotificationProps {
  pendingMangaCount: number;
  onResumeMatching: () => void;
  onCancelResume: () => void;
}

export const ResumeNotification: React.FC<ResumeNotificationProps> = ({
  pendingMangaCount,
  onResumeMatching,
  onCancelResume,
}) => {
  // Don't render anything if there are no pending manga
  if (pendingMangaCount <= 0) {
    return null;
  }

  return (
    <Card className="mb-6 overflow-hidden border-yellow-200 bg-yellow-50 shadow-md dark:border-yellow-900 dark:bg-yellow-900/20">
      <CardContent className="p-0">
        <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="rounded-full bg-yellow-100 p-2 dark:bg-yellow-800/30">
              <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <h3 className="mb-1 text-base font-medium text-yellow-800 dark:text-yellow-200">
                Unfinished Matching Process Detected
              </h3>
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                We found {pendingMangaCount} manga that weren&apos;t processed
                in your previous session.
              </p>
            </div>
          </div>
          <div className="flex flex-shrink-0 gap-3">
            <Button
              variant="default"
              onClick={onResumeMatching}
              className="bg-yellow-600 text-white hover:bg-yellow-700 dark:bg-yellow-700 dark:hover:bg-yellow-600"
            >
              <Play className="mr-2 h-4 w-4" />
              Resume Matching
            </Button>
            <Button variant="outline" onClick={onCancelResume}>
              <XCircle className="mr-2 h-4 w-4" />
              Cancel
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
