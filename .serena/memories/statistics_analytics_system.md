# Statistics & Analytics System

## Overview

The statistics system provides comprehensive analytics of the user's manga library including reading habits, genre distributions, completion rates, and trend analysis. Data is calculated in web workers for performance and displayed through interactive charts.

## Architecture

**Location**: `src/pages/StatisticsPage.tsx` and `src/components/statistics/`

### Chart Components

```text
statistics/
├─ StatisticsPage.tsx              # Main page component
├─ StatisticsFilterPanel.tsx       # Time range & filters
├─ ChaptersReadDistributionChart.tsx
├─ ComparisonToggle.tsx           # Compare Kenmei vs AniList
├─ DrillDownModal.tsx             # Detailed breakdown
├─ ExportStatisticsButton.tsx      # Export data
├─ FormatDistributionChart.tsx
├─ MatchProgressChart.tsx
├─ ReadingHabitsChart.tsx          # Reading frequency
├─ ReadingTrendsChart.tsx
├─ ReadingVelocityChart.tsx        # Chapters/month
├─ StatisticsErrorBoundary.tsx
├─ StatisticsFilterPanel.tsx
├─ StatusDistributionChart.tsx
├─ SyncMetricsChart.tsx
├─ TimeRangeSelector.tsx
└─ TopGenresChart.tsx
```

## Data Collection

### Source Data

**Collected from**:

1. **Match results** (src/utils/storage.ts)
   - Kenmei titles and metadata
   - Selected AniList matches
   - Match confidence scores

2. **AniList user data** (via API)
   - Current reading progress
   - Completion status
   - User ratings/scores
   - Last updated timestamp

3. **Import metadata**
   - Total imported manga count
   - Import date
   - Parsing statistics

## Statistics Calculated

### Match Progress

**Metrics**:

- Total manga imported
- Matched count
- Unmatched count
- Match rate percentage
- Average confidence score

**Display**: `MatchProgressChart.tsx`

```text
Match Status
────────────
Matched:   480/500 (96%)
Pending:   20/500 (4%)

Confidence Distribution
High (90+):  350 (73%)
Good (70-89): 100 (21%)
Low (<70):   30 (6%)
```

### Reading Statistics

**Metrics**:

- Total chapters read
- Average chapters per manga
- Reading speed (chapters/month)
- Estimated completion time

**Display**: `ReadingVelocityChart.tsx`

```text
Reading Velocity
────────────────
This Month: 15.3 chapters/day
Last Month:  8.2 chapters/day
30-Day Avg: 11.4 chapters/day
Projected: 342 chapters/month
```

### Genre Analysis

**Metrics**:

- Top genres by count
- Top genres by chapters
- Genre distribution pie chart
- Average rating by genre

**Display**: `TopGenresChart.tsx`

```text
Top Genres by Manga Count
──────────────────────────
1. Action         (45)
2. Romance        (42)
3. Sci-Fi         (38)
4. Fantasy        (35)
5. Comedy         (32)
```

### Format Distribution

**Metrics**:

- Manga count by format
- Chapters by format
- Status by format

**Display**: `FormatDistributionChart.tsx`

```text
Format Distribution
───────────────────
Manga:    420 manga (84%)
Manhua:   50 manga (10%)
Manhwa:   30 manga (6%)
```

### Status Distribution

**Metrics**:

- Reading count
- Completed count
- Dropped count
- On-hold count
- Planning count

**Display**: `StatusDistributionChart.tsx`

```text
Reading Status
──────────────
Reading:  80
Completed: 200
On Hold:   30
Dropped:   50
Planning:  140
```

### Reading Habits

**Metrics**:

- Busiest reading days (day of week)
- Reading frequency by hour
- Seasonal patterns
- Activity trends

**Display**: `ReadingHabitsChart.tsx`

```text
Most Active Days
────────────────
Friday:   52 entries updated
Saturday: 48 entries
Sunday:   45 entries
```

### Chapters Distribution

**Metrics**:

- Distribution of manga by chapter count
- Median/mode/average chapters
- Reading progress breakdown

**Display**: `ChaptersReadDistributionChart.tsx`

```text
Chapter Count Distribution
──────────────────────────
0-50 chapters:   150
51-100 chapters: 120
101-200:         90
201+:            140
```

### Sync Metrics

**Metrics**:

- Total sync operations
- Last sync date/time
- Entries synced per operation
- Sync success rate
- Failed operations count

**Display**: `SyncMetricsChart.tsx`

```text
Sync History (Last 30 Days)
──────────────────────────
Total Syncs:    45
Total Entries:  2,340
Success Rate:   98%
Last Sync:      2 hours ago
Failed:         2 entries
```

### Reading Trends

**Metrics**:

- Cumulative chapters over time
- Monthly completion rate
- Trend line analysis
- Prediction (on pace to finish?)

**Display**: `ReadingTrendsChart.tsx`

```text
Cumulative Chapters (90 Days)
─────────────────────────────
Day 1:    100 chapters
Day 30:   500 chapters
Day 60:   1,200 chapters
Day 90:   1,850 chapters
Trend:    Increasing ↗ (+20.5 chapters/day)
```

## Filtering System

### Time Range Selection

**Predefined ranges** (`TimeRangeSelector.tsx`):

- Last 7 days
- Last 30 days
- Last 90 days
- Last year
- All time
- Custom date range

**Implementation**:

```typescript
type TimeRange = 
  | "week"
  | "month"
  | "quarter"
  | "year"
  | "all"
  | { start: Date; end: Date };

// Filter data
const filtered = data.filter(item => 
  item.timestamp >= getStartDate(range) &&
  item.timestamp <= getEndDate(range)
);
```

### Status Filter

**Filter by reading status** (`StatisticsFilterPanel.tsx`):

- All statuses
- Reading only
- Completed only
- Dropped only
- On-hold only
- Planning only

**Multi-select**: Can combine multiple

### Genre Filter

**Filter by genres**:

- All genres
- Single genre
- Multiple genres (AND logic)
- Exclude genres

### Format Filter

**Filter by format**:

- Manga
- Manhua
- Manhwa
- Light novels (if included)

### Comparison Toggle

**`ComparisonToggle.tsx`**:

Compare Kenmei import data vs AniList current state

```text
Before Sync (Kenmei)    vs    After Sync (AniList)
───────────────────           ──────────────────
Total: 500                    Total: 480 (matched)
Chapters: 15,320              Chapters: 14,850 (synced)
Rating: 4.2/5 (avg)           Rating: 4.1/5 (AniList)
```

## Worker Integration

### Statistics Calculation

**`src/workers/statistics/statistics-worker-pool.ts`**:

Long-running calculations offloaded to workers:

```typescript
const statsPool = getStatisticsWorkerPool();
const stats = await statsPool.execute({
  manga: allManga,
  filters: { statusFilter: ["CURRENT"], timeRange: "month" },
  options: { aggregateBy: "genre" }
}, null, {
  onProgress: (p) => updateProgress(p)
});
```

### Operation Types

- **Aggregation**: Sum/count by dimension
- **Distribution**: Calculate percentiles
- **Trend**: Compute moving averages
- **Filtering**: Apply multiple criteria

### Progress Tracking

**For large datasets**:

```typescript
onProgress: (progress) => {
  console.log(`${progress.percentage}% complete`);
  updateProgressBar(progress);
};
```

## Data Export

### Export Formats

**CSV export** (`ExportStatisticsButton.tsx`):

```text
metric,value,unit,timestamp
"Total Manga","500","count","2024-11-11"
"Total Chapters","15320","chapters","2024-11-11"
"Average Rating","4.2","stars","2024-11-11"
"Reading Velocity","12.5","chapters/day","2024-11-11"
```

**JSON export**:

```json
{
  "exportDate": "2024-11-11T12:34:56Z",
  "statistics": {
    "overview": {
      "totalManga": 500,
      "totalChapters": 15320,
      "averageRating": 4.2
    },
    "byStatus": {
      "READING": 80,
      "COMPLETED": 200,
      "DROPPED": 50,
      "PLANNING": 140
    },
    "trends": [...]
  }
}
```

### Export Options

- Date range included
- Filters applied
- Chart data included
- Raw data included

## Drill-Down Modal

### Detailed Breakdown

**`DrillDownModal.tsx`**:

Click on chart segment to see details

Example - Genre breakdown:

```text
Genre: Action
──────────────
Total Manga:  45
Total Chapters: 3,240
Average Rating: 4.3
Status Distribution:
  Reading: 12
  Completed: 25
  On Hold: 5
  Dropped: 3
```

### Interactive Features

- Sort by different metrics
- Show individual titles
- Filter within breakdown
- Copy data to clipboard

## Cache & Performance

### Statistics Cache

**Stored in**: In-memory + localStorage

```typescript
interface CachedStatistics {
  timestamp: number;
  data: Statistics;
  hash: string; // Detect changes
}
```

**Invalidation**:

- Manual refresh button
- On new import
- On sync completion
- After 1 hour (auto-refresh)

**Performance**: Cache hit returns instantly

### Computation Optimization

**Web workers**:

- Main thread stays responsive
- Long calculations async
- Progress feedback during computation

**Sampling** (for very large datasets):

- If > 10,000 items, use sampling
- Statistical accuracy maintained
- Faster computation

## Data Adapter

**Location**: `src/utils/statisticsAdapter.ts`

Converts match results to statistics format:

```typescript
const stats = statisticsAdapter.adaptToStatistics(matchResults);

// Transforms
matchResults[{
  kenmeiManga: { title, genre, format, status, chapters },
  selectedMatch: { anilistId, rating, chapters }
}]
  ↓
stats[{
  title, genre, format,
  kenmeiChapters, anilistChapters,
  kenmeiRating, anilistRating,
  status, syncDate
}]
```

## Chart Libraries

**Technology**: Recharts + custom D3

- Line charts: Reading trends
- Pie charts: Distribution
- Bar charts: Top genres
- Area charts: Cumulative progress

## Error Handling

### Error Boundary

**`StatisticsErrorBoundary.tsx`**:

```text
Something went wrong displaying statistics
[Refresh] [Go Home]
```

**Recovery**:

- Show last cached data if available
- Allow retry
- Log error for debugging

### Missing Data

**Graceful degradation**:

- Show "N/A" for missing values
- Continue with available data
- Don't block entire page

## Accessibility

### Screen Reader Support

- Alt text for charts
- Data table view alternative
- Keyboard navigation
- High contrast mode support

### Data Labels

- All values labeled
- Units clearly shown
- Timestamps included
- Trends explained in text

## Testing

### Sample Data

```typescript
const mockStats = {
  totalManga: 500,
  byStatus: { READING: 80, COMPLETED: 200, ... },
  byGenre: { Action: 45, Romance: 42, ... },
  trends: [...]
};
```

### Chart Testing

```typescript
render(<StatisticsPage data={mockStats} />);
expect(screen.getByText("500")).toBeInTheDocument();
```
