/**
 * 指標收集系統 — 追蹤 API 效能、重試成功率、快取命中率等。
 *
 * 用途：
 * - 收集 API 響應時間（平均、P95、P99）
 * - 追蹤重試成功率（第 1 次、第 2 次、全部失敗）
 * - 追蹤快取命中率
 * - 記錄降級事件
 * - 生成效能摘要報告
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export interface APIMetric {
  name: string;
  attempts: number;  // 總重試次數（包含第 1 次）
  latency: number;   // 最終成功的延遲（毫秒）
  success: boolean;
  cached: boolean;
  timestamp: number;
}

export interface MetricsSummary {
  totalAPICalls: number;
  successRate: number;  // 0-1
  avgLatency: number;   // 毫秒
  p95Latency: number;
  p99Latency: number;
  cacheHitRate: number; // 0-1
  degradationCount: number;
  retryStats: {
    firstAttemptSuccess: number;
    retrySuccess: number;
    allFailed: number;
  };
}

class Metrics {
  private metrics: APIMetric[] = [];
  private maxMetricsSize = 1000;
  private lastReportTime = Date.now();
  private reportIntervalMs = 5 * 60 * 1000; // 5 分鐘

  recordAPICall(
    name: string,
    latency: number,
    success: boolean,
    attempts: number = 1,
    cached: boolean = false
  ) {
    const metric: APIMetric = {
      name,
      attempts,
      latency,
      success,
      cached,
      timestamp: Date.now(),
    };

    this.metrics.push(metric);
    if (this.metrics.length > this.maxMetricsSize) {
      this.metrics.shift();
    }

    // 定期輸出摘要報告
    if (Date.now() - this.lastReportTime > this.reportIntervalMs) {
      this.printSummary();
      this.lastReportTime = Date.now();
    }
  }

  /** 計算效能摘要 */
  getSummary(): MetricsSummary {
    const successful = this.metrics.filter(m => m.success);
    const failed = this.metrics.filter(m => !m.success);
    const cached = this.metrics.filter(m => m.cached);

    const latencies = successful.map(m => m.latency).sort((a, b) => a - b);

    // 計算百分位數
    const getPercentile = (arr: number[], p: number) => {
      if (arr.length === 0) return 0;
      const index = Math.ceil((p / 100) * arr.length) - 1;
      return arr[Math.max(0, index)];
    };

    const retryStats = {
      firstAttemptSuccess: this.metrics.filter(m => m.success && m.attempts === 1).length,
      retrySuccess: this.metrics.filter(m => m.success && m.attempts > 1).length,
      allFailed: failed.length,
    };

    return {
      totalAPICalls: this.metrics.length,
      successRate: this.metrics.length > 0 ? successful.length / this.metrics.length : 0,
      avgLatency: latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0,
      p95Latency: getPercentile(latencies, 95),
      p99Latency: getPercentile(latencies, 99),
      cacheHitRate: this.metrics.length > 0 ? cached.length / this.metrics.length : 0,
      degradationCount: failed.length,
      retryStats,
    };
  }

  /** 輸出摘要報告到控制台 */
  printSummary() {
    const summary = this.getSummary();
    console.info('[Metrics] Performance Summary:', {
      totalCalls: summary.totalAPICalls,
      successRate: `${(summary.successRate * 100).toFixed(1)}%`,
      avgLatency: `${summary.avgLatency.toFixed(0)}ms`,
      p95Latency: `${summary.p95Latency.toFixed(0)}ms`,
      p99Latency: `${summary.p99Latency.toFixed(0)}ms`,
      cacheHitRate: `${(summary.cacheHitRate * 100).toFixed(1)}%`,
      degradations: summary.degradationCount,
      retries: {
        firstAttempt: summary.retryStats.firstAttemptSuccess,
        afterRetry: summary.retryStats.retrySuccess,
        failed: summary.retryStats.allFailed,
      },
    });
  }

  /** 取得最近 N 筆指標 */
  getRecentMetrics(count: number = 100): APIMetric[] {
    return this.metrics.slice(-count);
  }

  /** 清空所有指標 */
  clear() {
    this.metrics = [];
  }

  /** 儲存到本地（用於離線分析） */
  async saveToStorage() {
    try {
      await AsyncStorage.setItem('@metrics_dump', JSON.stringify({
        metrics: this.metrics,
        summary: this.getSummary(),
        exportTime: Date.now(),
      }));
    } catch (err) {
      console.error('[Metrics] Failed to save to storage:', err);
    }
  }

  /** 從本地載入 */
  async loadFromStorage() {
    try {
      const data = await AsyncStorage.getItem('@metrics_dump');
      if (data) {
        const parsed = JSON.parse(data);
        this.metrics = parsed.metrics || [];
      }
    } catch (err) {
      console.error('[Metrics] Failed to load from storage:', err);
    }
  }
}

// 全局單例
export const metricsService = new Metrics();

/** 記錄 API 呼叫（便捷函數） */
export function recordAPIMetric(
  name: string,
  latency: number,
  success: boolean,
  attempts?: number,
  cached?: boolean
) {
  metricsService.recordAPICall(name, latency, success, attempts, cached);
}

/** 取得效能摘要 */
export function getMetricsSummary(): MetricsSummary {
  return metricsService.getSummary();
}
