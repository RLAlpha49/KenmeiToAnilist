import React from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { AlertCircle } from "lucide-react";

interface Props {
  onGoToSettings: () => void;
}

export default function AuthRequiredCard({ onGoToSettings }: Readonly<Props>) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.25, duration: 0.3 }}
    >
      <Card className="mx-auto w-full max-w-lg overflow-hidden border-amber-200 bg-amber-50/30 text-center dark:border-amber-800/30 dark:bg-amber-900/10">
        <CardContent className="pt-6 pb-4">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
            <AlertCircle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
          </div>
          <h3 className="text-lg font-medium">Authentication Required</h3>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            You need to be authenticated with AniList to match your manga.
          </p>
          <Button
            onClick={onGoToSettings}
            className="mt-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
          >
            Go to Settings
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}
