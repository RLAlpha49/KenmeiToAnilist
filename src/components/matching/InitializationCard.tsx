import React from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "../ui/card";
import { Loader2 } from "lucide-react";

interface Props {
  message?: string;
}

export default function InitializationCard({ message }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.3 }}
    >
      <Card className="mb-6 border-blue-100 bg-blue-50/50 shadow-md dark:border-blue-900/50 dark:bg-blue-900/20">
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-3">
            <div className="relative flex h-8 w-8 items-center justify-center">
              <div className="absolute h-full w-full animate-ping rounded-full bg-blue-400 opacity-20"></div>
              <Loader2 className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="font-medium text-blue-700 dark:text-blue-300">
                {message || "Checking for pending manga to resume..."}
              </p>
              <p className="text-sm text-blue-600/80 dark:text-blue-400/80">
                Please wait while we analyze your previous session
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
