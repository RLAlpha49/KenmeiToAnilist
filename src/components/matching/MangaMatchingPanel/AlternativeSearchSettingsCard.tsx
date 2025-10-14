import React from "react";
import { Ban, SatelliteDish } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../ui/card";
import { Switch } from "../../ui/switch";
import { Label } from "../../ui/label";
import { Badge } from "../../ui/badge";

export interface AlternativeSearchSettingsCardProps {
  enableMangaDexSearch: boolean;
  onComickSearchToggle: (enabled: boolean) => void;
  onMangaDexSearchToggle: (enabled: boolean) => void;
}

function AlternativeSearchSettingsCardComponent({
  enableMangaDexSearch,
  onComickSearchToggle,
  onMangaDexSearchToggle,
}: Readonly<AlternativeSearchSettingsCardProps>) {
  return (
    <Card className="relative mb-4 overflow-hidden rounded-3xl border border-white/40 bg-white/75 shadow-xl shadow-slate-900/5 backdrop-blur dark:border-slate-800/60 dark:bg-slate-900/70">
      <div className="pointer-events-none absolute top-0 -left-20 h-48 w-48 rounded-full bg-violet-400/15 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 bottom-0 h-56 w-56 rounded-full bg-sky-400/15 blur-3xl" />
      <CardHeader className="relative z-10 flex flex-col gap-3 border-b border-white/40 pb-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800/60">
        <div>
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white">
            <SatelliteDish className="h-4 w-4 text-sky-500" />
            Alternative Search Channels
          </CardTitle>
          <CardDescription className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Automatically fall back to trusted sources when AniList results are
            inconclusive.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="relative z-10 space-y-4 p-5">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="relative overflow-hidden rounded-2xl border border-amber-400/40 bg-amber-50/70 p-4 shadow-md shadow-amber-500/10 dark:border-amber-500/30 dark:bg-amber-900/20">
            <div className="pointer-events-none absolute -top-16 right-4 h-32 w-32 rounded-full bg-amber-500/20 blur-3xl" />
            <div className="relative flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch
                    id="comick-search-toggle"
                    checked={false}
                    disabled
                    onCheckedChange={onComickSearchToggle}
                  />
                  <Label
                    htmlFor="comick-search-toggle"
                    className="cursor-not-allowed text-sm font-semibold text-amber-800 opacity-80 dark:text-amber-200"
                  >
                    Comick (Temporarily Unavailable)
                  </Label>
                </div>
                <Badge
                  variant="secondary"
                  className="flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-200/60 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-amber-800 uppercase dark:border-amber-500/30 dark:bg-amber-900/30 dark:text-amber-200"
                >
                  <Ban className="h-3 w-3" />
                  Disabled
                </Badge>
              </div>
              <p className="text-xs text-amber-800/90 dark:text-amber-100">
                Comick is undergoing a platform transition. This will be
                reactivated when their API is available again.
              </p>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-sky-400/40 bg-sky-50/70 p-4 shadow-md shadow-sky-500/10 dark:border-sky-500/30 dark:bg-sky-900/20">
            <div className="pointer-events-none absolute -bottom-16 left-4 h-32 w-32 rounded-full bg-sky-500/20 blur-3xl" />
            <div className="relative flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch
                    id="mangadex-search-toggle"
                    checked={enableMangaDexSearch}
                    onCheckedChange={onMangaDexSearchToggle}
                  />
                  <Label
                    htmlFor="mangadex-search-toggle"
                    className="text-sm font-semibold text-sky-800 dark:text-sky-100"
                  >
                    MangaDex Alternative Search
                  </Label>
                </div>
                <Badge
                  variant="secondary"
                  className="flex items-center gap-1 rounded-full border border-sky-500/20 bg-sky-100/70 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-sky-700 uppercase dark:border-sky-500/30 dark:bg-sky-900/40 dark:text-sky-200"
                >
                  {enableMangaDexSearch ? "Active" : "Disabled"}
                </Badge>
              </div>
              <p className="text-xs text-sky-900/90 dark:text-sky-100">
                When enabled, AniList searches fall back to MangaDex&apos;s top
                result if no direct match is found.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const AlternativeSearchSettingsCard = React.memo(
  AlternativeSearchSettingsCardComponent,
);
AlternativeSearchSettingsCard.displayName = "AlternativeSearchSettingsCard";

export { AlternativeSearchSettingsCard };
