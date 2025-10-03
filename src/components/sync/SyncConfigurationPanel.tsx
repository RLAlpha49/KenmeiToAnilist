import React from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../ui/collapsible";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import { Label } from "../ui/label";
import type { LucideIcon } from "lucide-react";
import {
  Settings,
  ShieldCheck,
  CheckCircle2,
  Gauge,
  Star,
  Lock,
  Clock3,
  ChevronDown,
} from "lucide-react";
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
  const toggleOptions: Array<{
    key: keyof SyncConfig;
    title: string;
    description: string;
    icon: LucideIcon;
    accent: string;
  }> = [
    {
      key: "prioritizeAniListStatus",
      title: "Prioritize AniList status",
      description:
        "Keeps your existing AniList status when differences are detected.",
      icon: ShieldCheck,
      accent: "from-blue-500 to-indigo-500",
    },
    {
      key: "preserveCompletedStatus",
      title: "Preserve completed entries",
      description:
        "Protects anything marked completed in AniList from further changes.",
      icon: CheckCircle2,
      accent: "from-emerald-500 to-emerald-600",
    },
    {
      key: "prioritizeAniListProgress",
      title: "Prioritize AniList progress",
      description:
        "Keeps the higher chapter count between AniList and Kenmei records.",
      icon: Gauge,
      accent: "from-sky-500 to-blue-500",
    },
    {
      key: "prioritizeAniListScore",
      title: "Prioritize AniList scores",
      description:
        "Maintains your AniList scores unless Kenmei has stronger data.",
      icon: Star,
      accent: "from-amber-500 to-orange-500",
    },
    {
      key: "setPrivate",
      title: "Set entries as private",
      description:
        "Applies AniList privacy to new or updated entries when enabled.",
      icon: Lock,
      accent: "from-purple-500 to-fuchsia-500",
    },
  ];

  return (
    <Collapsible className="space-y-3">
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="group flex w-full items-center justify-between rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-blue-200/70 hover:bg-blue-50/70 data-[state=open]:border-blue-200/70 data-[state=open]:bg-blue-50/70 dark:border-slate-800/70 dark:bg-slate-950/60 dark:text-slate-100 dark:hover:border-blue-800/50 dark:hover:bg-blue-950/20 dark:data-[state=open]:border-blue-900/50 dark:data-[state=open]:bg-blue-950/30"
        >
          <span className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-blue-500 dark:text-blue-400" />
            Sync Configuration
          </span>
          <div className="flex items-center gap-2 text-xs text-slate-500 transition group-data-[state=open]:text-blue-500 dark:text-slate-400 dark:group-data-[state=open]:text-blue-300">
            <span>Adjust your rules</span>
            <ChevronDown className="h-4 w-4 transition-transform duration-300 group-data-[state=open]:rotate-180" />
          </div>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-4 space-y-4 rounded-3xl border border-slate-200/60 bg-white/80 p-5 shadow-sm backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-950/60">
        <div className="grid gap-4 md:grid-cols-2">
          {toggleOptions.map((option) => {
            const Icon = option.icon;
            return (
              <div
                key={option.key as string}
                className="flex flex-col gap-3 rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-sm transition hover:border-blue-200/60 hover:shadow-md dark:border-slate-800/60 dark:bg-slate-950/50 dark:hover:border-blue-900/50"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${option.accent} text-white shadow`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                      <Label
                        htmlFor={option.key as string}
                        className="text-sm font-semibold text-slate-900 dark:text-slate-100"
                      >
                        {option.title}
                      </Label>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {option.description}
                      </p>
                    </div>
                  </div>
                  <Switch
                    id={option.key as string}
                    checked={Boolean(syncConfig[option.key])}
                    onCheckedChange={() => handleToggleOption(option.key)}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="rounded-2xl border border-amber-200/70 bg-amber-50/60 p-4 shadow-sm transition hover:border-amber-300/70 hover:shadow-md dark:border-amber-800/40 dark:bg-amber-900/20">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow">
                <Clock3 className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <Label
                  htmlFor="autoPauseInactive"
                  className="text-sm font-semibold text-slate-900 dark:text-slate-100"
                >
                  Auto-pause inactive manga
                </Label>
                <p className="text-xs text-amber-700 dark:text-amber-300/80">
                  Automatically pause series that haven&apos;t updated recently.
                </p>
              </div>
            </div>
            <Switch
              id="autoPauseInactive"
              checked={syncConfig.autoPauseInactive}
              onCheckedChange={() => handleToggleOption("autoPauseInactive")}
            />
          </div>

          {syncConfig.autoPauseInactive && (
            <div className="mt-4 space-y-3 rounded-2xl border border-amber-200/70 bg-white/80 p-4 shadow-sm dark:border-amber-800/40 dark:bg-slate-950/60">
              <Label
                htmlFor="autoPauseThreshold"
                className="text-xs font-semibold tracking-wide text-amber-700 uppercase dark:text-amber-300/80"
              >
                Pause after
              </Label>
              {useCustomThreshold ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <input
                    id="customAutoPauseThreshold"
                    type="number"
                    min="1"
                    placeholder="Enter days"
                    value={syncConfig.autoPauseThreshold.toString()}
                    onChange={(e) => {
                      const value = Number.parseInt(e.target.value, 10);
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
                    className="h-9 w-full rounded-lg border border-amber-200/70 bg-white/90 px-3 text-sm text-slate-700 shadow-sm transition outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-200 dark:border-amber-800/40 dark:bg-slate-950/70 dark:text-slate-100 dark:focus:border-amber-700 dark:focus:ring-amber-900/40"
                  />
                  <Button
                    variant="outline"
                    className="h-9 rounded-lg border-amber-200/70 px-3 text-xs font-semibold text-amber-700 hover:border-amber-300 hover:bg-amber-100/60 dark:border-amber-800/40 dark:text-amber-300 dark:hover:border-amber-600 dark:hover:bg-amber-900/20"
                    onClick={() => setUseCustomThreshold(false)}
                  >
                    Use Presets
                  </Button>
                </div>
              ) : (
                <select
                  id="autoPauseThreshold"
                  value={syncConfig.autoPauseThreshold.toString()}
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
                  className="h-9 w-full rounded-lg border border-amber-200/70 bg-white/90 px-3 text-sm text-slate-700 shadow-sm transition outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-200 dark:border-amber-800/40 dark:bg-slate-950/70 dark:text-slate-100 dark:focus:border-amber-700 dark:focus:ring-amber-900/40"
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
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Series beyond this window are automatically paused on AniList.
              </p>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
