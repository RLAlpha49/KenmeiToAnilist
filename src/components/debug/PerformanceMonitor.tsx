/**
 * @packageDocumentation
 * @module PerformanceMonitor
 * @description Real-time performance monitoring dashboard showing API latency and memory usage.
 */

// TODO: UI hitches when updating the API latency chart.

import React, { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import { useDebugState } from "../../contexts/DebugContext";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Zap, Cpu } from "lucide-react";
import { cn } from "@/utils/tailwind";
import type { MemoryMetrics } from "@/types/debug";

type MetricCardStatus = "good" | "warning" | "critical";

const STATUS_LABELS: Record<MetricCardStatus, string> = {
  good: "Healthy",
  warning: "Monitor",
  critical: "Critical",
};

const STATUS_BADGE_CLASSES: Record<MetricCardStatus, string> = {
  good: "border-emerald-500/40 bg-emerald-500/10 text-emerald-500",
  warning: "border-amber-500/40 bg-amber-500/10 text-amber-500",
  critical: "border-red-500/40 bg-red-500/10 text-red-500",
};

function StatusPill({
  label,
  status,
  value,
}: Readonly<{
  label: string;
  status: MetricCardStatus;
  value: string;
}>) {
  return (
    <div
      className={cn(
        "border-border/60 bg-background/70 flex items-center gap-2 rounded-full border px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-wide",
        STATUS_BADGE_CLASSES[status],
      )}
    >
      <span className="text-foreground/80 font-medium">{label}</span>
      <span className="text-foreground text-xs normal-case">{value}</span>
      <span className="text-foreground/70 text-[0.65rem] normal-case">
        {STATUS_LABELS[status]}
      </span>
    </div>
  );
}

/**
 * Metric card component for displaying performance data
 * @source
 */
function MetricCard({
  title,
  description,
  value,
  unit,
  icon: Icon,
  status,
  chart,
}: Readonly<{
  title: string;
  description: string;
  value: string | number;
  unit?: string;
  icon: React.ComponentType<{ className?: string }>;
  status?: MetricCardStatus;
  chart?: React.ReactNode;
}>) {
  const statusColors = {
    good: "text-emerald-500 bg-emerald-500/10",
    warning: "text-amber-500 bg-amber-500/10",
    critical: "text-red-500 bg-red-500/10",
  };

  const statusBadge = {
    good: STATUS_BADGE_CLASSES.good,
    warning: STATUS_BADGE_CLASSES.warning,
    critical: STATUS_BADGE_CLASSES.critical,
  } satisfies Record<MetricCardStatus, string>;

  return (
    <Card className="border-border/50 overflow-hidden">
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
        <div className="flex flex-col gap-1">
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
          <CardDescription className="text-xs">{description}</CardDescription>
        </div>
        <div className={cn("rounded-lg p-2", statusColors[status ?? "good"])}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-3xl font-bold tracking-tight">{value}</span>
          {unit && (
            <span className="text-muted-foreground text-sm">{unit}</span>
          )}
          {status && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide",
                statusBadge[status],
              )}
            >
              {STATUS_LABELS[status]}
            </span>
          )}
        </div>
        {chart && <div className="mt-4">{chart}</div>}
      </CardContent>
    </Card>
  );
}

/**
 * Real-time performance monitoring dashboard
 * Displays API latency and memory usage with interactive charts
 * @returns JSX element rendering the performance monitor
 * @source
 */
export function PerformanceMonitor() {
  const { performanceMetrics } = useDebugState();
  const [selectedProvider, setSelectedProvider] = React.useState<string>("all");

  // Get unique providers from recent samples
  const availableProviders = useMemo(() => {
    const providers = new Set(
      performanceMetrics.api.recentSamples.map((s) => s.provider),
    );
    return Array.from(providers).sort((a, b) => a.localeCompare(b));
  }, [performanceMetrics.api.recentSamples]);

  // Filter samples by selected provider
  const filteredSamples = useMemo(() => {
    if (selectedProvider === "all") {
      return performanceMetrics.api.recentSamples;
    }
    return performanceMetrics.api.recentSamples.filter(
      (s) => s.provider === selectedProvider,
    );
  }, [performanceMetrics.api.recentSamples, selectedProvider]);

  // Prepare chart data
  const apiLatencyData = useMemo(() => {
    const samples = performanceMetrics.api.recentSamples.slice(-20);

    // Build provider-specific latency series with sequential x-axis positions
    const dataPoints: Array<{
      name: string;
      [key: string]: string | number;
    }> = [];

    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i];
      const providerKey = sample.provider.toLowerCase();

      // Check if we already have a data point at this position
      if (!dataPoints[i]) {
        dataPoints[i] = { name: `${i + 1}` };
      }

      // Store latency value, ensuring it's a valid number for chart rendering
      dataPoints[i][providerKey] = Number.isFinite(sample.duration)
        ? Number.parseFloat(sample.duration.toFixed(1))
        : 0;
    }

    return dataPoints;
  }, [performanceMetrics.api.recentSamples]);

  // Get unique providers for chart lines
  const apiProviders = useMemo(() => {
    const providers = new Set(
      performanceMetrics.api.recentSamples.map((s) => s.provider.toLowerCase()),
    );
    return Array.from(providers).sort((a, b) => a.localeCompare(b));
  }, [performanceMetrics.api.recentSamples]);

  // Color palette for providers
  const providerColors: Record<string, string> = {
    anilist: "#06b6d4",
    mangadex: "#f59e0b",
    comick: "#8b5cf6",
    default: "#ef4444",
  };

  const getProviderColor = (provider: string): string => {
    const key = provider.toLowerCase();
    return providerColors[key] || providerColors.default;
  };

  const memoryData = useMemo(() => {
    return performanceMetrics.memory.history
      .slice(-20)
      .map((sample: MemoryMetrics, index: number) => ({
        name: `${index + 1}`,
        // Convert units to MB for display: heap is bytes, private/shared are KB
        heapUsed: Number.isFinite(sample.heap)
          ? Number.parseFloat((sample.heap / 1024).toFixed(1))
          : 0,
        privateMemory: Number.isFinite(sample.private)
          ? Number.parseFloat((sample.private / 1024).toFixed(1))
          : 0,
        sharedMemory: Number.isFinite(sample.shared)
          ? Number.parseFloat((sample.shared / 1024).toFixed(1))
          : 0,
      }));
  }, [performanceMetrics.memory.history]);

  // Calculate statistics
  const avgApiLatency = useMemo(() => {
    const latencies = performanceMetrics.api.recentLatencies.filter(
      Number.isFinite,
    );
    return latencies.length > 0
      ? (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2)
      : "0";
  }, [performanceMetrics.api.recentLatencies]);

  const avgMemory = useMemo(() => {
    const samples = performanceMetrics.memory.history;
    if (samples.length === 0) return "0";

    const totalBytes = samples.reduce((acc: number, s: MemoryMetrics) => {
      const heapBytes = Number.isFinite(s.heap) ? s.heap * 1024 : 0;
      const privateBytes = Number.isFinite(s.private) ? s.private * 1024 : 0;
      const sharedBytes = Number.isFinite(s.shared) ? s.shared * 1024 : 0;
      return acc + heapBytes + privateBytes + sharedBytes;
    }, 0);

    const avgBytes = totalBytes / samples.length;
    // Convert to MB for display
    return (avgBytes / (1024 * 1024)).toFixed(1);
  }, [performanceMetrics.memory.history]);

  // Determine status based on metrics
  const getApiLatencyStatus = (): MetricCardStatus => {
    const latency = Number.parseFloat(avgApiLatency);
    if (latency > 2000) return "critical";
    if (latency > 1000) return "warning";
    return "good";
  };

  const getMemoryStatus = (): MetricCardStatus => {
    const history = performanceMetrics.memory.history;
    if (!history.length) return "warning";
    const latest = history.at(-1);
    if (!latest) return "warning";
    const heapMb = latest.heap / 1024;
    if (heapMb > 1500) return "critical";
    if (heapMb > 1000) return "warning";
    return "good";
  };

  const determineLatencyStatus = (latency: number): MetricCardStatus => {
    if (!Number.isFinite(latency)) return "warning";
    if (latency > 2000) return "critical";
    if (latency > 1000) return "warning";
    return "good";
  };

  const latestMemorySample =
    performanceMetrics.memory.history.length > 0
      ? (performanceMetrics.memory.history.at(-1) ?? null)
      : null;

  const memorySnapshot = useMemo(() => {
    if (!latestMemorySample) return null;
    // Convert units properly: heap is bytes, private/shared are KB
    const heapMb = Number.isFinite(latestMemorySample.heap)
      ? Number.parseFloat((latestMemorySample.heap / 1024).toFixed(1))
      : 0;
    const privateMb = Number.isFinite(latestMemorySample.private)
      ? Number.parseFloat((latestMemorySample.private / 1024).toFixed(1))
      : 0;
    const sharedMb = Number.isFinite(latestMemorySample.shared)
      ? Number.parseFloat((latestMemorySample.shared / 1024).toFixed(1))
      : 0;

    // Sum all components for total memory footprint
    const totalMb = Number.parseFloat(
      (heapMb + privateMb + sharedMb).toFixed(1),
    );

    return {
      total: totalMb.toFixed ? totalMb.toFixed(1) : String(totalMb),
      heap: heapMb,
      private: privateMb,
      shared: sharedMb,
      timestamp: latestMemorySample.timestamp,
    };
  }, [latestMemorySample]);

  const formattedMemoryTimestamp = useMemo(() => {
    if (!memorySnapshot) return null;
    return new Date(memorySnapshot.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }, [memorySnapshot]);

  const averageLatencyNumber = Number.parseFloat(avgApiLatency);

  const recentApiSamples = useMemo(() => {
    const last100 = filteredSamples.slice(-100);

    return last100
      .map((sample, index) => {
        const delta =
          Number.isFinite(sample.duration) &&
          Number.isFinite(averageLatencyNumber)
            ? sample.duration - averageLatencyNumber
            : Number.NaN;

        return {
          id: index + 1,
          latency: sample.duration,
          delta,
          provider: sample.provider,
          endpoint: sample.endpoint || "unknown",
          status: determineLatencyStatus(sample.duration),
        };
      })
      .reverse();
  }, [filteredSamples, averageLatencyNumber]);

  const latencyStatus = getApiLatencyStatus();
  const memoryStatus = getMemoryStatus();

  return (
    <div className="space-y-10 p-6">
      <div className="space-y-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold">
              Performance Command Center
            </h2>
            <p className="text-muted-foreground text-sm">
              Monitor cross-layer health at a glance and jump directly to
              detailed diagnostics.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusPill
            label="API"
            status={latencyStatus}
            value={`${avgApiLatency} ms`}
          />
          <StatusPill
            label="Memory"
            status={memoryStatus}
            value={`${avgMemory} MB avg`}
          />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr,2fr]">
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <MetricCard
              title="API Latency"
              description="Average response time"
              value={avgApiLatency}
              unit="ms"
              icon={Zap}
              status={latencyStatus}
              chart={
                apiLatencyData.length > 0 ? (
                  <div className="h-[100px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={apiLatencyData}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="var(--border)"
                          vertical={false}
                        />
                        <XAxis dataKey="name" hide tick={{ fontSize: 12 }} />
                        <YAxis
                          hide
                          tick={{ fontSize: 12 }}
                          domain={[0, "auto"]}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "var(--background)",
                            border: "1px solid var(--border)",
                            borderRadius: "0.5rem",
                          }}
                          formatter={(value) => `${value} ms`}
                        />
                        {apiProviders.map((provider) => (
                          <Line
                            key={provider}
                            type="monotone"
                            dataKey={provider}
                            stroke={getProviderColor(provider)}
                            strokeWidth={2}
                            dot={false}
                            isAnimationActive={false}
                            connectNulls
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="text-muted-foreground text-xs">
                    No API calls recorded yet.
                  </div>
                )
              }
            />

            <MetricCard
              title="Memory Usage"
              description="Renderer process snapshot"
              value={memorySnapshot ? memorySnapshot.total : avgMemory}
              unit="MB"
              icon={Cpu}
              status={memoryStatus}
              chart={
                memorySnapshot ? (
                  <div className="text-muted-foreground grid grid-cols-2 gap-3 text-xs">
                    <div className="flex flex-col gap-1">
                      <span className="text-muted-foreground/80">Heap</span>
                      <span className="text-foreground font-medium">
                        {memorySnapshot.heap} MB
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-muted-foreground/80">Private</span>
                      <span className="text-foreground font-medium">
                        {memorySnapshot.private} MB
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-muted-foreground/80">Shared</span>
                      <span className="text-foreground font-medium">
                        {memorySnapshot.shared} MB
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-muted-foreground/80">Sampled</span>
                      <span className="text-foreground font-medium">
                        {formattedMemoryTimestamp ?? "-"}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-muted-foreground text-xs">
                    Awaiting memory telemetry.
                  </div>
                )
              }
            />
          </div>

          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3">
                <div>
                  <CardTitle className="text-sm">Recent API samples</CardTitle>
                </div>
                {availableProviders.length > 1 && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-xs">
                      Provider:
                    </span>
                    <select
                      value={selectedProvider}
                      onChange={(e) => setSelectedProvider(e.target.value)}
                      className="border-border/40 bg-background/80 text-foreground rounded border px-2 py-1 text-sm"
                    >
                      <option value="all">All</option>
                      {availableProviders.map((provider) => (
                        <option key={provider} value={provider}>
                          {provider}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {recentApiSamples.length ? (
                <div className="max-h-96 space-y-2 overflow-y-auto">
                  {recentApiSamples.map((sample) => {
                    let deltaClass = "text-muted-foreground";
                    if (Number.isFinite(sample.delta)) {
                      if (sample.delta > 0) {
                        deltaClass = "text-amber-500";
                      } else if (sample.delta < 0) {
                        deltaClass = "text-emerald-500";
                      }
                    }

                    let deltaDisplay: string | null = null;
                    if (Number.isFinite(sample.delta)) {
                      const deltaValue = sample.delta;
                      deltaDisplay =
                        deltaValue > 0
                          ? `+${deltaValue.toFixed(0)} ms`
                          : `${deltaValue.toFixed(0)} ms`;
                    }

                    return (
                      <div
                        key={`${sample.id}-${sample.provider}`}
                        className="border-border/40 bg-background/70 flex flex-col gap-2 rounded-xl border px-3 py-2 text-sm"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                              {sample.provider.toUpperCase()}
                            </span>
                            <span className="text-muted-foreground text-xs">
                              {sample.endpoint}
                            </span>
                            <span className="text-foreground font-semibold">
                              {Number.isFinite(sample.latency)
                                ? `${sample.latency.toFixed(0)} ms`
                                : "N/A"}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            {deltaDisplay && (
                              <span
                                className={cn(
                                  "text-xs font-medium",
                                  deltaClass,
                                )}
                              >
                                {deltaDisplay}
                              </span>
                            )}
                            <span
                              className={cn(
                                "inline-flex items-center rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide",
                                STATUS_BADGE_CLASSES[sample.status],
                              )}
                            >
                              {STATUS_LABELS[sample.status]}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-muted-foreground text-center text-sm">
                  No API samples available for selected provider
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">API Latency timeline</CardTitle>
              <CardDescription>
                Visualise the last 20 request durations
              </CardDescription>
            </CardHeader>
            <CardContent>
              {apiLatencyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={apiLatencyData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--border)"
                    />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      label={{
                        value: "ms",
                        angle: -90,
                        position: "insideLeft",
                      }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--background)",
                        border: "1px solid var(--border)",
                        borderRadius: "0.5rem",
                      }}
                      formatter={(value) => `${value} ms`}
                    />
                    <Legend />
                    {apiProviders.map((provider) => (
                      <Line
                        key={provider}
                        type="monotone"
                        dataKey={provider}
                        stroke={getProviderColor(provider)}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                        isAnimationActive={false}
                        connectNulls
                        name={provider.toUpperCase()}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-muted-foreground flex h-[260px] items-center justify-center text-sm">
                  No latency data yet
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">
                Memory utilisation trend
              </CardTitle>
              <CardDescription>
                Last 20 samples (2.5 second cadence)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {memoryData.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={memoryData}>
                    <defs>
                      <linearGradient
                        id="colorHeapUsed"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#06b6d4"
                          stopOpacity={0.8}
                        />
                        <stop
                          offset="95%"
                          stopColor="#06b6d4"
                          stopOpacity={0}
                        />
                      </linearGradient>
                      <linearGradient
                        id="colorPrivate"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#8b5cf6"
                          stopOpacity={0.8}
                        />
                        <stop
                          offset="95%"
                          stopColor="#8b5cf6"
                          stopOpacity={0}
                        />
                      </linearGradient>
                      <linearGradient
                        id="colorShared"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#f59e0b"
                          stopOpacity={0.8}
                        />
                        <stop
                          offset="95%"
                          stopColor="#f59e0b"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--border)"
                    />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      label={{
                        value: "MB",
                        angle: -90,
                        position: "insideLeft",
                      }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--background)",
                        border: "1px solid var(--border)",
                        borderRadius: "0.5rem",
                      }}
                      formatter={(value) => `${value} MB`}
                    />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="heapUsed"
                      stroke="#06b6d4"
                      name="Heap Used"
                      fillOpacity={1}
                      fill="url(#colorHeapUsed)"
                      isAnimationActive={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="privateMemory"
                      stroke="#8b5cf6"
                      name="Private"
                      fillOpacity={1}
                      fill="url(#colorPrivate)"
                      isAnimationActive={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="sharedMemory"
                      stroke="#f59e0b"
                      name="Shared"
                      fillOpacity={1}
                      fill="url(#colorShared)"
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-muted-foreground flex h-[260px] items-center justify-center text-sm">
                  No memory data yet
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
