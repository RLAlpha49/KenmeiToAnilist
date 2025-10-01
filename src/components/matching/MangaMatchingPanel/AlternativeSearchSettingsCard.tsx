import React from "react";
import { Info } from "lucide-react";
import { Card, CardContent } from "../../ui/card";
import { Switch } from "../../ui/switch";
import { Label } from "../../ui/label";

export interface AlternativeSearchSettingsCardProps {
  enableMangaDexSearch: boolean;
  onComickSearchToggle: (enabled: boolean) => void;
  onMangaDexSearchToggle: (enabled: boolean) => void;
}

export function AlternativeSearchSettingsCard({
  enableMangaDexSearch,
  onComickSearchToggle,
  onMangaDexSearchToggle,
}: Readonly<AlternativeSearchSettingsCardProps>) {
  return (
    <Card className="mb-4">
      <CardContent className="p-4">
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="comick-search-toggle"
                    checked={false}
                    disabled={true}
                    onCheckedChange={onComickSearchToggle}
                  />
                  <Label
                    htmlFor="comick-search-toggle"
                    className="text-muted-foreground cursor-not-allowed text-sm leading-none font-medium opacity-70"
                  >
                    Enable Comick Alternative Search (Temporarily Disabled)
                  </Label>
                </div>
                <div className="group relative flex">
                  <Info className="text-muted-foreground h-4 w-4" />
                  <div className="bg-card absolute bottom-full left-1/2 z-50 mb-2 hidden w-80 -translate-x-1/2 transform rounded-md border px-3 py-2 text-xs font-medium shadow-lg group-hover:block">
                    Comick has been temporarily taken down. This feature is
                    disabled until Comick fully transitions as a tracking site
                    and their API is restored.
                  </div>
                </div>
              </div>
              <div className="ml-6 rounded-md bg-yellow-50 px-3 py-2 text-xs text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300">
                <strong>Notice:</strong> Comick alternative search is
                temporarily disabled as Comick has been taken down. The API
                should hopefully be restored after Comick completes its
                transition as a tracking site.
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center space-x-2">
                <Switch
                  id="mangadex-search-toggle"
                  checked={enableMangaDexSearch}
                  onCheckedChange={onMangaDexSearchToggle}
                />
                <Label
                  htmlFor="mangadex-search-toggle"
                  className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Enable MangaDex Alternative Search
                </Label>
              </div>
              <div className="group relative flex">
                <Info className="text-muted-foreground h-4 w-4" />
                <div className="bg-card absolute bottom-full left-1/2 z-50 mb-2 hidden w-80 -translate-x-1/2 transform rounded-md border px-3 py-2 text-xs font-medium shadow-lg group-hover:block">
                  When enabled, the system will attempt alternative searches
                  through MangaDex if the initial AniList search doesn&apos;t
                  find matches. This feature will be automatically ignored when
                  rate limited and will continue searching normally. Only the
                  top search result from MangaDex will be used.
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
