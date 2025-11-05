/**
 * @packageDocumentation
 * @module statistics
 * @description Chart components for the statistics dashboard, including status distribution, genre analysis, timeline progress, sync metrics, format breakdown, and reading progress visualizations.
 * @source
 */

/**
 * Donut chart visualizing manga status distribution across the library.
 * @source
 */
export { StatusDistributionChart } from "./StatusDistributionChart";

/**
 * Horizontal bar chart displaying the most frequent genres in the matched collection.
 * @source
 */
export { TopGenresChart } from "./TopGenresChart";

/**
 * Stacked area chart showing cumulative match progress over time by status.
 * @source
 */
export { MatchProgressChart } from "./MatchProgressChart";

/**
 * Composed chart with bars and line overlay visualizing sync performance metrics.
 * @source
 */
export { SyncMetricsChart } from "./SyncMetricsChart";

/**
 * Pie chart showing the distribution of manga formats in the matched library.
 * @source
 */
export { FormatDistributionChart } from "./FormatDistributionChart";

/**
 * Histogram displaying the distribution of chapters read across matched manga.
 * @source
 */
export { ChaptersReadDistributionChart } from "./ChaptersReadDistributionChart";

/**
 * Line chart with gradient fill showing chapters read trends over time.
 * @source
 */
export { ReadingTrendsChart } from "./ReadingTrendsChart";

/**
 * Chart component showing reading patterns by day of week and time of day.
 * @source
 */
export { ReadingHabitsChart } from "./ReadingHabitsChart";

/**
 * Metric cards displaying average reading velocity (chapters per day/week/month).
 * @source
 */
export { ReadingVelocityChart } from "./ReadingVelocityChart";

/**
 * Button group control for selecting time ranges in statistics charts.
 * @source
 */
export { TimeRangeSelector } from "./TimeRangeSelector";
