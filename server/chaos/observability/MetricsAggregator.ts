export interface RawMetricSample {
  readonly timestamp: string;
  readonly serviceName: string;
  readonly metricName: "LATENCY" | "CPU" | "MEMORY" | "ERROR_RATE" | "REQUEST_COUNT";
  readonly value: number;
}

export interface MetricSummary {
  readonly serviceName: string;
  readonly metricName: string;
  readonly count: number;
  readonly average: number;
  readonly min: number;
  readonly max: number;
  readonly p50: number;
  readonly p90: number;
  readonly p99: number;
}

export class MetricsAggregator {
  /**
   * Aggregates raw metric points into structured statistical metrics reports.
   */
  public static aggregate(samples: readonly RawMetricSample[]): readonly MetricSummary[] {
    const groups = new Map<string, number[]>();

    samples.forEach((sample) => {
      const key = `${sample.serviceName}::${sample.metricName}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(sample.value);
    });

    const summaries: MetricSummary[] = [];

    groups.forEach((values, key) => {
      const [serviceName, metricName] = key.split("::");
      const sorted = [...values].sort((a, b) => a - b);
      const count = sorted.length;
      const sum = sorted.reduce((acc, curr) => acc + curr, 0);
      const average = count > 0 ? sum / count : 0;
      const min = count > 0 ? sorted[0] : 0;
      const max = count > 0 ? sorted[count - 1] : 0;

      const getPercentile = (p: number): number => {
        if (count === 0) return 0;
        const index = Math.ceil((p / 100) * count) - 1;
        return sorted[Math.max(0, index)];
      };

      summaries.push(
        Object.freeze({
          serviceName,
          metricName,
          count,
          average,
          min,
          max,
          p50: getPercentile(50),
          p90: getPercentile(90),
          p99: getPercentile(99),
        })
      );
    });

    return Object.freeze(summaries);
  }
}
