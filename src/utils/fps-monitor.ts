/**
 * @packageDocumentation
 * @module fpsMonitor
 * @description FPS (frames per second) monitoring utility for detecting rendering performance issues.
 */

/**
 * Options for FPS monitoring behavior.
 * @source
 */
export interface FPSMonitorOptions {
  /** FPS threshold below which to trigger warnings (default: 30) */
  threshold?: number;
  /** Number of frames to average over (default: 60) */
  sampleSize?: number;
  /** Callback when FPS drops below threshold */
  onLowFPS?: (fps: number) => void | undefined;
  /** Whether monitoring is active (default: true) */
  enabled?: boolean;
}

export class FPSMonitor {
  private frameTimestamps: number[] = [];
  private rafId: number | null = null;
  private isRunning = false;
  private lastFPS = 60;
  private averageFPS = 60;
  private lastLowFPSNotification = 0;
  private readonly options: Required<Omit<FPSMonitorOptions, "onLowFPS">> & {
    onLowFPS?: (fps: number) => void;
  };

  constructor(options?: FPSMonitorOptions) {
    this.options = {
      threshold: options?.threshold ?? 30,
      sampleSize: options?.sampleSize ?? 60,
      onLowFPS: options?.onLowFPS,
      enabled: options?.enabled !== false,
    };
  }

  /**
   * Start monitoring FPS.
   */
  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.frameTimestamps = [];
    this.lastFPS = 60;
    this.averageFPS = 60;

    const loop = () => {
      if (!this.isRunning) return;

      const now = performance.now();
      this.frameTimestamps.push(now);

      // Keep only the last N frames
      if (this.frameTimestamps.length > this.options.sampleSize) {
        this.frameTimestamps.shift();
      }

      // Calculate FPS when we have enough samples
      if (this.frameTimestamps.length > 1) {
        const span = this.frameTimestamps.at(-1)! - this.frameTimestamps.at(0)!;
        const frameCount = this.frameTimestamps.length - 1;

        if (span > 0) {
          this.averageFPS = (frameCount / span) * 1000; // frames per second
        }

        // Notify if FPS is low (throttle notifications to once per second)
        if (this.options.onLowFPS && this.averageFPS < this.options.threshold) {
          const nowMs = Date.now();
          if (nowMs - this.lastLowFPSNotification > 1000) {
            this.options.onLowFPS(this.averageFPS);
            this.lastLowFPSNotification = nowMs;
          }
        }
      }

      this.rafId = requestAnimationFrame(loop);
    };

    this.rafId = requestAnimationFrame(loop);
  }

  /**
   * Stop monitoring FPS.
   */
  stop(): void {
    this.isRunning = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.frameTimestamps = [];
  }

  /**
   * Get the current FPS (most recent sample).
   */
  getCurrentFPS(): number {
    if (this.frameTimestamps.length < 2) {
      return this.lastFPS;
    }

    const lastTwo = this.frameTimestamps.slice(-2);
    const deltaMs = lastTwo[1] - lastTwo[0];

    if (deltaMs > 0) {
      this.lastFPS = 1000 / deltaMs;
    }

    return this.lastFPS;
  }

  /**
   * Get the average FPS over the sample window.
   */
  getAverageFPS(): number {
    return this.averageFPS;
  }

  /**
   * Check if FPS is currently low.
   */
  isLowFPS(): boolean {
    return this.averageFPS < this.options.threshold;
  }
}
