import React from "react";
import { Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../components/ui/card";
import { motion } from "framer-motion";

interface CacheClearingNotificationProps {
  cacheClearingCount: number;
}

export const CacheClearingNotification: React.FC<
  CacheClearingNotificationProps
> = ({ cacheClearingCount }) => {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/20 dark:bg-black/40"></div>
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: "spring", damping: 15 }}
        className="relative z-10 mx-auto w-full max-w-md px-4"
      >
        <Card className="border-blue-200 shadow-lg dark:border-blue-800">
          <CardHeader className="pb-2 text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600 dark:text-blue-400" />
            </div>
            <CardTitle className="text-xl">Clearing Cache</CardTitle>
            <CardDescription className="text-center">
              Please wait while we clear cache for {cacheClearingCount} selected
              manga
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-6 text-center">
            <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-blue-100 dark:bg-blue-900/30">
              <motion.div
                className="absolute top-0 left-0 h-full bg-blue-600 dark:bg-blue-500"
                initial={{ width: "0%" }}
                animate={{
                  width: ["0%", "100%", "0%"],
                  transition: {
                    repeat: Infinity,
                    duration: 1.5,
                    ease: "linear",
                  },
                }}
              />
            </div>
            <p className="text-muted-foreground mt-4 text-sm">
              This may take a moment. We&apos;re preparing fresh searches from
              AniList.
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
};
