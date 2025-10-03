import React from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../ui/collapsible";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import { Label } from "../ui/label";
import { Settings } from "lucide-react";
import { SyncConfig, saveSyncConfig } from "../../utils/storage";

interface SyncConfigurationPanelProps {
  syncConfig: SyncConfig;
  setSyncConfig: React.Dispatch<React.SetStateAction<SyncConfig>>;
  useCustomThreshold: boolean;
  setUseCustomThreshold: React.Dispatch<React.SetStateAction<boolean>>;
  handleToggleOption: (option: keyof SyncConfig) => void;
}

export function SyncConfigurationPanel({
  syncConfig,
  setSyncConfig,
  useCustomThreshold,
  setUseCustomThreshold,
  handleToggleOption,
}: Readonly<SyncConfigurationPanelProps>) {
  return (
    <Collapsible className="mb-4">
      <CollapsibleTrigger asChild>
        <Button
          variant="outline"
          className="flex w-full items-center justify-between p-3"
        >
          <span className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Sync Configuration
          </span>
          <span className="text-muted-foreground text-xs">Click to expand</span>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 rounded-md border bg-slate-50 p-4 dark:bg-slate-900">
        <div className="space-y-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label
                htmlFor="prioritizeAniListStatus"
                className="flex-1 text-sm"
              >
                Prioritize AniList status{" "}
                <span className="text-muted-foreground block text-xs">
                  When enabled, keeps your existing AniList status
                </span>
              </Label>
              <Switch
                id="prioritizeAniListStatus"
                checked={syncConfig.prioritizeAniListStatus}
                onCheckedChange={() =>
                  handleToggleOption("prioritizeAniListStatus")
                }
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label
                htmlFor="preserveCompletedStatus"
                className="flex-1 text-sm"
              >
                Preserve Completed Status{" "}
                <span className="text-muted-foreground block text-xs">
                  Always preserve entries marked as COMPLETED in AniList
                </span>
              </Label>
              <Switch
                id="preserveCompletedStatus"
                checked={syncConfig.preserveCompletedStatus}
                onCheckedChange={() =>
                  handleToggleOption("preserveCompletedStatus")
                }
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label
                htmlFor="prioritizeAniListProgress"
                className="flex-1 text-sm"
              >
                Prioritize AniList progress{" "}
                <span className="text-muted-foreground block text-xs">
                  When enabled, keeps higher chapter counts from AniList (Does
                  not apply when the prioritized source is 0 or none/null)
                </span>
              </Label>
              <Switch
                id="prioritizeAniListProgress"
                checked={syncConfig.prioritizeAniListProgress}
                onCheckedChange={() =>
                  handleToggleOption("prioritizeAniListProgress")
                }
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label
                htmlFor="prioritizeAniListScore"
                className="flex-1 text-sm"
              >
                Prioritize AniList scores{" "}
                <span className="text-muted-foreground block text-xs">
                  When enabled, keeps your existing AniList scores (Does not
                  apply when the prioritized source is none/null)
                </span>
              </Label>
              <Switch
                id="prioritizeAniListScore"
                checked={syncConfig.prioritizeAniListScore}
                onCheckedChange={() =>
                  handleToggleOption("prioritizeAniListScore")
                }
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="setPrivate" className="flex-1 text-sm">
                Set entries as private{" "}
                <span className="text-muted-foreground block text-xs">
                  When enabled, sets entries as private. Doesn&apos;t change
                  existing private settings.
                </span>
              </Label>
              <Switch
                id="setPrivate"
                checked={syncConfig.setPrivate}
                onCheckedChange={() => handleToggleOption("setPrivate")}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="autoPauseInactive" className="flex-1 text-sm">
                Auto-pause inactive manga{" "}
                <span className="text-muted-foreground block text-xs">
                  When enabled, sets manga as PAUSED if not updated recently
                  (Can specify the period)
                </span>
              </Label>
              <Switch
                id="autoPauseInactive"
                checked={syncConfig.autoPauseInactive}
                onCheckedChange={() => handleToggleOption("autoPauseInactive")}
              />
            </div>
          </div>

          {syncConfig.autoPauseInactive && (
            <div className="mt-2 border-l-2 border-slate-200 pl-2 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <Label
                  htmlFor="autoPauseThreshold"
                  className="text-sm whitespace-nowrap"
                >
                  Pause after
                </Label>
                {useCustomThreshold ? (
                  <div className="flex w-full items-center gap-2">
                    <input
                      id="customAutoPauseThreshold"
                      type="number"
                      min="1"
                      placeholder="Enter days"
                      value={syncConfig.autoPauseThreshold.toString()}
                      onChange={(e) => {
                        const value = Number.parseInt(e.target.value);
                        if (!Number.isNaN(value) && value > 0) {
                          setSyncConfig((prev) => {
                            const newConfig = {
                              ...prev,
                              autoPauseThreshold: value,
                            };
                            saveSyncConfig(newConfig);
                            return newConfig;
                          });
                        }
                      }}
                      className="border-input bg-background focus-visible:ring-ring h-8 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors focus-visible:ring-1 focus-visible:outline-none"
                    />
                    <Button
                      variant="outline"
                      className="h-8 px-2"
                      onClick={() => setUseCustomThreshold(false)}
                    >
                      Use Presets
                    </Button>
                  </div>
                ) : (
                  <select
                    id="autoPauseThreshold"
                    value={syncConfig.autoPauseThreshold}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === "custom") {
                        setUseCustomThreshold(true);
                      } else {
                        setSyncConfig((prev) => {
                          const newConfig = {
                            ...prev,
                            autoPauseThreshold: Number(value),
                          };
                          saveSyncConfig(newConfig);
                          return newConfig;
                        });
                      }
                    }}
                    className="border-input bg-background focus-visible:ring-ring h-8 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors focus-visible:ring-1 focus-visible:outline-none"
                  >
                    <option value="1">1 day</option>
                    <option value="7">7 days</option>
                    <option value="14">14 days</option>
                    <option value="30">30 days</option>
                    <option value="60">2 months</option>
                    <option value="90">3 months</option>
                    <option value="180">6 months</option>
                    <option value="365">1 year</option>
                    <option value="custom">Custom...</option>
                  </select>
                )}
              </div>

              <p className="text-muted-foreground mt-1 text-xs">
                Manga not updated for this period will be set to PAUSED
              </p>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
