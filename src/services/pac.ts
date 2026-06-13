import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

export type PACNetworkState = 'online' | 'offline' | 'weak';
export type PACHealingState = 'stable' | 'healing' | 'degraded';

export interface PACState {
  network: PACNetworkState;
  healing: PACHealingState;
  pendingTasksCount: number;
  lastError: string | null;
  cpuMode: 'normal' | 'power-saving';
}

type PACListener = (state: PACState) => void;

class ProjectAutonomicCore {
  private state: PACState = {
    network: 'online',
    healing: 'stable',
    pendingTasksCount: 0,
    lastError: null,
    cpuMode: 'normal',
  };

  private listeners = new Set<PACListener>();
  private errorCounts: Record<string, number> = {};
  private pendingQueue: { id: string; action: () => Promise<void> }[] = [];
  private debounceTimers: Record<string, any> = {};
  private clickCooldowns: Record<string, number> = {};
  private pingRetryTimer: any = null;
  private pingRetryDelay = 5000;

  constructor() {
    this.initNetworkMonitoring();
  }

  // 1. Initialize Network Monitor using NetInfo and light pings
  private initNetworkMonitoring() {
    // Web environment support fallback
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      this.state.network = window.navigator.onLine ? 'online' : 'offline';
      window.addEventListener('online', () => {
        this.performPingVerification();
      });
      window.addEventListener('offline', () => this.updateNetworkState('offline'));
    }

    // Subscribe to native and web network state changes via NetInfo
    NetInfo.addEventListener((state) => {
      const isConnected = !!state.isConnected;
      if (isConnected) {
        this.performPingVerification();
      } else {
        this.updateNetworkState('offline');
      }
    });

    // Initialize state on app startup
    NetInfo.fetch().then((state) => {
      const isConnected = !!state.isConnected;
      if (isConnected) {
        this.performPingVerification();
      } else {
        this.updateNetworkState('offline');
      }
    });
  }

  private markOnline() {
    if (this.state.network !== 'online') {
      this.updateNetworkState('online');
    }
    if (this.state.healing === 'degraded' && this.pendingQueue.length === 0) {
      this.state.healing = 'stable';
      this.state.lastError = null;
      this.notify();
    }
  }

  private async performPingVerification() {
    // 瀏覽器環境：跨來源的連線偵測請求一律受 CORS 阻擋（對 google.com 等外站發出的
    // fetch 會直接拋錯），因此外部 ping 在 web 上不是可靠的連線訊號。改為信任瀏覽器
    // 自身的 navigator.onLine 狀態，避免誤判為離線而導致 AI 請求被攔截、誤走離線備援。
    if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
      if (navigator.onLine) {
        this.markOnline();
      } else if (this.state.network !== 'offline') {
        this.updateNetworkState('offline');
      }
      return;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 秒超時限制

      // 原生環境：使用 no-cors 模式發出輕量請求。只要能解析（即使是 opaque 回應）即代表
      // 網路可達；唯有拋錯或逾時才判定為離線。不可依賴 response.ok（opaque 回應永遠為 false）。
      await fetch('https://www.google.com', {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-cache',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      this.markOnline();
    } catch (e) {
      // 請求逾時或異常，判定為無網際網路連線（如受限 Wi-Fi）
      if (this.state.network !== 'offline') {
        this.updateNetworkState('offline');
      }
    }
  }

  private startPingRetryLoop() {
    if (this.pingRetryTimer) return;

    const run = async () => {
      if (this.state.network === 'online') {
        this.pingRetryTimer = null;
        this.pingRetryDelay = 5000;
        return;
      }

      await this.performPingVerification();

      if (this.getState().network !== 'online') {
        // 指數退避重試，最大間隔為 60 秒
        this.pingRetryDelay = Math.min(this.pingRetryDelay * 2, 60000);
        this.pingRetryTimer = setTimeout(run, this.pingRetryDelay);
      } else {
        this.pingRetryTimer = null;
        this.pingRetryDelay = 5000;
      }
    };

    this.pingRetryTimer = setTimeout(run, this.pingRetryDelay);
  }

  public resetHealingState() {
    this.state.healing = 'stable';
    this.state.lastError = null;
    this.notify();
  }

  private updateNetworkState(network: PACNetworkState) {
    this.state.network = network;
    this.notify();

    if (network === 'online') {
      if (this.pingRetryTimer) {
        clearTimeout(this.pingRetryTimer);
        this.pingRetryTimer = null;
      }
      this.pingRetryDelay = 5000;

      if (this.pendingQueue.length > 0) {
        // 網路復原時自動執行排程佇列（自我修復）
        this.drainPendingQueue();
      }
    } else if (this.pendingQueue.length > 0) {
      this.startPingRetryLoop();
    }
  }

  // 2. Self-Healing Executor: Auto-retry with backoff, fall back to local Mock/Cache on fatal failures.
  public async executeWithHealing<T>(
    action: () => Promise<T>,
    fallbackAction: () => T,
    actionName: string,
    maxRetries: number = 3,
    fatalErrors: string[] = []
  ): Promise<T> {
    this.state.healing = 'healing';
    this.notify();

    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        // 注意：不要因為快取的 network 狀態為 'offline' 就預先拒絕執行。該狀態可能因
        // 連線偵測誤判（例如瀏覽器 CORS 阻擋外部 ping）而失準。真正的網路請求本身才是
        // 連線與否的權威判定 —— 若確實離線，action() 會自行拋錯並走入下方的備援流程。
        const result = await action();
        
        // Reset error count on successful execution
        this.errorCounts[actionName] = 0;
        this.state.healing = 'stable';
        this.state.lastError = null;
        this.notify();
        return result;

      } catch (error: any) {
        if (fatalErrors.includes(error?.message)) {
          throw error; // Bypass self-healing and fallback immediately
        }

        attempt++;
        const delay = Math.pow(2, attempt) * 500; // Exponential Backoff: 1s, 2s, 4s...
        const errorMsg = error?.message || error?.toString?.() || 'Unknown error';
        console.warn(`[PAC Self-Healing] ${actionName} failed (attempt ${attempt}/${maxRetries}). Retrying in ${delay}ms... Error: ${errorMsg}`);

        if (attempt < maxRetries) {
          await new Promise((res) => setTimeout(res, delay));
        }
      }
    }

    // Degrade and use fallback
    console.warn(`[PAC Self-Healing] ${actionName} failed after ${maxRetries} attempts. Using fallback...`);
    this.errorCounts[actionName] = (this.errorCounts[actionName] || 0) + 1;
    this.state.healing = 'degraded';
    this.state.lastError = `Action ${actionName} failed after ${maxRetries} attempts. Falling back to local offline processor.`;
    this.notify();

    return fallbackAction();
  }

  // 3. Self-Optimization: Async Write Debounce Buffer
  public debounceWrite(
    key: string,
    data: string,
    writeFn: (key: string, val: string) => Promise<void>,
    delayMs: number = 1500
  ) {
    if (this.debounceTimers[key]) {
      clearTimeout(this.debounceTimers[key]);
    }

    // Optimize CPU / memory usage during high frequency edits
    this.state.cpuMode = 'power-saving';
    this.notify();

    this.debounceTimers[key] = setTimeout(async () => {
      try {
        await writeFn(key, data);
      } catch (err) {
        console.error(`[PAC Self-Optimization] Debounced write failed for key ${key}:`, err);
      } finally {
        this.state.cpuMode = 'normal';
        this.notify();
      }
    }, delayMs);
  }

  // 4. Self-Healing Offline Queue: Buffer modifications while offline, automatically synchronize on reconnect
  public enqueuePendingTask(taskId: string, task: () => Promise<void>) {
    // Check if task with same ID is already in queue, update it instead of duplicating
    const existingIndex = this.pendingQueue.findIndex(t => t.id === taskId);
    if (existingIndex !== -1) {
      this.pendingQueue[existingIndex] = { id: taskId, action: task };
    } else {
      this.pendingQueue.push({ id: taskId, action: task });
    }

    this.state.pendingTasksCount = this.pendingQueue.length;
    this.notify();

    if (this.state.network !== 'online') {
      this.startPingRetryLoop();
    }
  }

  private async drainPendingQueue() {
    console.log(`[PAC Self-Healing] Connection restored. Draining ${this.pendingQueue.length} pending tasks...`);
    const tasksToProcess = [...this.pendingQueue];
    this.pendingQueue = [];
    this.state.pendingTasksCount = 0;
    this.notify();

    for (const task of tasksToProcess) {
      try {
        await task.action();
      } catch (err) {
        console.error(`[PAC Self-Healing] Failed to sync pending task ${task.id}:`, err);
        // Put back to queue if it fails due to network again
        this.enqueuePendingTask(task.id, task.action);
      }
    }
  }

  // 5. Self-Protection: Rate limiter & debounced click cooldown
  public executeWithProtection(actionId: string, action: () => void, cooldownMs: number = 800): boolean {
    const now = Date.now();
    const lastClickTime = this.clickCooldowns[actionId] || 0;

    if (now - lastClickTime < cooldownMs) {
      console.warn(`[PAC Self-Protection] Intercepted rapid click event on ${actionId} (Rate-limited).`);
      return false; // Request blocked
    }

    this.clickCooldowns[actionId] = now;
    action();
    return true;
  }

  private notify() {
    // Use setTimeout 0 to ensure all listener state updates are broadcasted asynchronously
    // outside of React's current render/schedule phase, preventing state-update-in-render conflict errors.
    setTimeout(() => {
      this.listeners.forEach((listener) => {
        try {
          listener({ ...this.state });
        } catch (e) {
          console.error('[PACEngine] Error calling listener:', e);
        }
      });
    }, 0);
  }

  // Listener subscriptions
  public subscribe(listener: PACListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getState(): PACState {
    return { ...this.state };
  }
}

export const PACEngine = new ProjectAutonomicCore();
export default PACEngine;
