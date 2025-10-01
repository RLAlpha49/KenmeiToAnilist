import React from "react";
import { motion } from "framer-motion";

interface Props {
  error: string | null;
  onDismiss: () => void;
}

export default function MatchingErrorToast({ error, onDismiss }: Props) {
  if (!error) return null;

  return (
    <motion.div
      className="fixed right-4 bottom-4 max-w-sm rounded-md bg-red-50 p-4 shadow-lg dark:bg-red-900/30"
      initial={{ opacity: 0, x: 20, y: 20 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex">
        <div className="flex-shrink-0">
          <svg
            className="h-5 w-5 text-red-400"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div className="ml-3">
          <p className="text-sm font-medium text-red-800 dark:text-red-200">
            {error}
          </p>
          <div className="mt-2 flex space-x-2">
            <button
              onClick={onDismiss}
              className="rounded-md bg-red-100 px-2 py-1 text-xs font-medium text-red-800 hover:bg-red-200 dark:bg-red-800 dark:text-red-100 dark:hover:bg-red-700"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
