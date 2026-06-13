/**
 * 統一日誌服務 — 支援命名空間、日誌等級、結構化輸出。
 *
 * 用途：
 * - 集中管理所有日誌，便於開發和監控
 * - 支援日誌等級過濾（debug, info, warn, error）
 * - 結構化輸出，便於聚合和遠端傳送
 * - 預留遠端日誌介面（Sentry, LogRocket 等）
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: number;
  namespace: string;
  level: LogLevel;
  message: string;
  data?: any;
}

interface RemoteLogHandler {
  (entry: LogEntry): Promise<void>;
}

class Logger {
  private namespace: string;
  private minLevel: LogLevel = 'debug';
  private remoteHandler: RemoteLogHandler | null = null;
  private buffer: LogEntry[] = [];
  private maxBufferSize = 100;

  constructor(namespace: string) {
    this.namespace = namespace;
  }

  setMinLevel(level: LogLevel) {
    this.minLevel = level;
  }

  setRemoteHandler(handler: RemoteLogHandler | null) {
    this.remoteHandler = handler;
  }

  private getLevelIndex(level: LogLevel): number {
    const levels: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
    return levels[level];
  }

  private shouldLog(level: LogLevel): boolean {
    return this.getLevelIndex(level) >= this.getLevelIndex(this.minLevel);
  }

  private format(level: LogLevel, message: string): string {
    return `[${this.namespace}] ${message}`;
  }

  private async sendRemote(entry: LogEntry) {
    if (this.remoteHandler) {
      try {
        await this.remoteHandler(entry);
      } catch (err) {
        console.error('[Logger] Failed to send remote log:', err);
      }
    }
  }

  private log(level: LogLevel, message: string, data?: any) {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: Date.now(),
      namespace: this.namespace,
      level,
      message,
      data,
    };

    // 輸出到 console
    const formatted = this.format(level, message);
    const consoleMethod = console[level] || console.log;
    if (data) {
      consoleMethod(formatted, data);
    } else {
      consoleMethod(formatted);
    }

    // 儲存到緩衝區
    this.buffer.push(entry);
    if (this.buffer.length > this.maxBufferSize) {
      this.buffer.shift();
    }

    // 遠端傳送
    this.sendRemote(entry);
  }

  debug(message: string, data?: any) {
    this.log('debug', message, data);
  }

  info(message: string, data?: any) {
    this.log('info', message, data);
  }

  warn(message: string, data?: any) {
    this.log('warn', message, data);
  }

  error(message: string, data?: any) {
    this.log('error', message, data);
  }

  /** 取得日誌緩衝區內容 */
  getBuffer(): LogEntry[] {
    return [...this.buffer];
  }

  /** 清空日誌緩衝區 */
  clearBuffer() {
    this.buffer = [];
  }
}

/** 全局日誌實例快取 */
const loggers = new Map<string, Logger>();

/**
 * 建立或取得指定命名空間的 Logger 實例
 * @param namespace 命名空間名稱（如 'poi', 'wiki', 'guidePack'）
 */
export function createLogger(namespace: string): Logger {
  if (!loggers.has(namespace)) {
    loggers.set(namespace, new Logger(namespace));
  }
  return loggers.get(namespace)!;
}

/** 取得所有 Logger 實例 */
export function getAllLoggers(): Map<string, Logger> {
  return loggers;
}

/** 全局設定日誌等級 */
export function setGlobalMinLevel(level: LogLevel) {
  loggers.forEach(logger => logger.setMinLevel(level));
}

/** 全局設定遠端日誌處理器 */
export function setGlobalRemoteHandler(handler: RemoteLogHandler | null) {
  loggers.forEach(logger => logger.setRemoteHandler(handler));
}

/** 合併所有日誌（用於調試和監控） */
export function getAllLogs(): LogEntry[] {
  const all: LogEntry[] = [];
  loggers.forEach(logger => {
    all.push(...logger.getBuffer());
  });
  // 按時間戳排序
  return all.sort((a, b) => a.timestamp - b.timestamp);
}

/** 清空所有日誌 */
export function clearAllLogs() {
  loggers.forEach(logger => logger.clearBuffer());
}
