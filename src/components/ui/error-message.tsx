import React from "react";
import { AlertCircle, WifiOff, Lock, Server, Ban } from "lucide-react";
import { ErrorType } from "../../utils/errorHandling";

interface ErrorMessageProps {
  message: string;
  type?: ErrorType;
  retry?: () => void;
  dismiss?: () => void;
}

export function ErrorMessage({
  message,
  type = ErrorType.UNKNOWN,
  retry,
  dismiss,
}: ErrorMessageProps) {
  const getIcon = () => {
    switch (type) {
      case ErrorType.NETWORK:
        return <WifiOff className="h-5 w-5" />;
      case ErrorType.AUTHENTICATION:
        return <Lock className="h-5 w-5" />;
      case ErrorType.API:
        return <Server className="h-5 w-5" />;
      case ErrorType.VALIDATION:
        return <Ban className="h-5 w-5" />;
      default:
        return <AlertCircle className="h-5 w-5" />;
    }
  };

  const getBackgroundColor = () => {
    switch (type) {
      case ErrorType.NETWORK:
        return "bg-yellow-50 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800";
      case ErrorType.AUTHENTICATION:
        return "bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800";
      case ErrorType.API:
        return "bg-purple-50 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border-purple-200 dark:border-purple-800";
      case ErrorType.VALIDATION:
        return "bg-orange-50 text-orange-800 dark:bg-orange-950 dark:text-orange-300 border-orange-200 dark:border-orange-800";
      default:
        return "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-300 border-red-200 dark:border-red-800";
    }
  };

  return (
    <div
      className={`flex items-start gap-3 rounded-lg border p-4 ${getBackgroundColor()}`}
    >
      <div className="shrink-0 pt-0.5">{getIcon()}</div>
      <div className="flex-1">
        <p className="mb-1 font-medium">{message}</p>
        {(retry || dismiss) && (
          <div className="mt-2 flex gap-3">
            {retry && (
              <button
                onClick={retry}
                className="rounded bg-white px-2 py-1 text-xs font-medium shadow-sm hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700"
              >
                Try Again
              </button>
            )}
            {dismiss && (
              <button
                onClick={dismiss}
                className="rounded px-2 py-1 text-xs font-medium hover:bg-white/20 dark:hover:bg-black/20"
              >
                Dismiss
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
