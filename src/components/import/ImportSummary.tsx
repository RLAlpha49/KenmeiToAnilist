import React from "react";
import { KenmeiExport, KenmeiStatus } from "../../api/kenmei/types";
import {
  BookOpen,
  CheckCircle,
  PauseCircle,
  XCircle,
  Clock,
  BookOpenCheck,
  ArrowRight,
  FilePlus,
} from "lucide-react";
import { Button } from "../ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Badge } from "../ui/badge";
import { Separator } from "../ui/separator";

interface ImportSummaryProps {
  data: KenmeiExport;
  onProceed: () => void;
  onCancel: () => void;
}

interface StatusCount {
  status: KenmeiStatus;
  count: number;
  icon: React.ReactNode;
  label: string;
  color: string;
  bgColor: string;
}

export function ImportSummary({
  data,
  onProceed,
  onCancel,
}: ImportSummaryProps) {
  const { manga } = data;

  const totalEntries = manga.length;

  // Group manga by status
  const statusCounts: Record<KenmeiStatus, number> = {
    reading: 0,
    completed: 0,
    on_hold: 0,
    dropped: 0,
    plan_to_read: 0,
  };

  manga.forEach((item) => {
    statusCounts[item.status]++;
  });

  const statusInfo: StatusCount[] = [
    {
      status: "reading",
      count: statusCounts.reading,
      icon: <BookOpen className="h-5 w-5" />,
      label: "Reading",
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-50 dark:bg-blue-950/30",
    },
    {
      status: "completed",
      count: statusCounts.completed,
      icon: <CheckCircle className="h-5 w-5" />,
      label: "Completed",
      color: "text-green-600 dark:text-green-400",
      bgColor: "bg-green-50 dark:bg-green-950/30",
    },
    {
      status: "on_hold",
      count: statusCounts.on_hold,
      icon: <PauseCircle className="h-5 w-5" />,
      label: "On Hold",
      color: "text-amber-600 dark:text-amber-400",
      bgColor: "bg-amber-50 dark:bg-amber-950/30",
    },
    {
      status: "dropped",
      count: statusCounts.dropped,
      icon: <XCircle className="h-5 w-5" />,
      label: "Dropped",
      color: "text-red-600 dark:text-red-400",
      bgColor: "bg-red-50 dark:bg-red-950/30",
    },
    {
      status: "plan_to_read",
      count: statusCounts.plan_to_read,
      icon: <Clock className="h-5 w-5" />,
      label: "Plan to Read",
      color: "text-purple-600 dark:text-purple-400",
      bgColor: "bg-purple-50 dark:bg-purple-950/30",
    },
  ];

  return (
    <Card className="bg-background overflow-hidden border-none shadow-md">
      <CardHeader className="bg-gradient-to-r from-blue-500/10 to-indigo-500/10 pb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-r from-blue-500 to-indigo-500 text-white">
            <FilePlus className="h-4 w-4" />
          </div>
          <div>
            <CardTitle>Import Summary</CardTitle>
            <CardDescription>
              Review your data before proceeding
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-muted-foreground text-sm">
              Total entries to import
            </p>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold">{totalEntries}</span>
              <Badge variant="outline" className="ml-2 font-mono">
                manga
              </Badge>
            </div>
          </div>
          <div className="h-14 w-14 rounded-full bg-indigo-100 p-3 dark:bg-indigo-900/30">
            <BookOpenCheck className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
          </div>
        </div>

        <Separator />

        <div>
          <h3 className="mb-3 text-sm font-medium">Status breakdown</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {statusInfo.map((status) => (
              <Card
                key={status.status}
                className={`overflow-hidden border ${status.count > 0 ? "shadow-sm" : "opacity-50"}`}
              >
                <CardContent
                  className={`p-3 ${status.count > 0 ? status.bgColor : "bg-muted/30"}`}
                >
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                      <span className={status.color}>{status.icon}</span>
                      <p className="text-xs font-medium">{status.label}</p>
                    </div>
                    <span
                      className={`mt-1 text-2xl font-bold ${status.count > 0 ? status.color : "text-muted-foreground"}`}
                    >
                      {status.count}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex justify-end gap-3 pt-2 pb-6">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button className="gap-1" onClick={onProceed}>
          Continue
          <ArrowRight className="h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}
