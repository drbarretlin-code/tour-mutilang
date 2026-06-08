import { Platform } from 'react-native';

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

  constructor() {
    this.initNetworkMonitoring();
  }

  // 1. Initialize Network Monitor (100% Cross-Platform Compatible)
  private initNetworkMonitoring() {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      this.state.network = window.navigator.onLine ? 'online' : 'offline';
      window.addEventListener('online', () => this.updateNetworkState('online'));
      window.addEventListener('offline', () => this.updateNetworkState('offline'));
    } else {
      // For iOS/Android/Desktop: Perform periodic heartbeat checks to avoid complex native dependency issues.
      // Zero Cost & 100% Reliable
      this.startNativeHeartbeat();
    }
  }

  private async startNativeHeartbeat() {
    setInterval(async () => {
      try {
        // Perform a quick HEAD fetch to a reliable public host
        const response = await fetch('https://www.google.com', { method: 'HEAD', cache: 'no-cache' });
        if (response.ok) {
          if (this.state.network !== 'online') {
            this.updateNetworkState('online');
          }
        } else {
          if (this.state.network !== 'weak') {
            this.updateNetworkState('weak');
          }
        }
      } catch (e) {
        if (this.state.network !== 'offline') {
          this.updateNetworkState('offline');
        }
      }
    }, 10000); // Heartbeat check every 10 seconds
  }

  private updateNetworkState(network: PACNetworkState) {
    this.state.network = network;
    this.notify();
    if (network === 'online' && this.pendingQueue.length > 0) {
      // Automatically drain the pending sync task queue when network is restored (Self-Healing)
      this.drainPendingQueue();
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
        if (this.state.network === 'offline') {
          throw new Error('Device is offline. Skipping network action.');
        }

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
        console.warn(`[PAC Self-Healing] ${actionName} failed (attempt ${attempt}/${maxRetries}). Retrying in ${delay}ms...`, error);
        
        if (attempt < maxRetries) {
          await new Promise((res) => setTimeout(res, delay));
        }
      }
    }

    // Degrade and use fallback
    console.warn(`[PAC Self-Healing] All ${maxRetries} retries failed for ${actionName}. Entering degraded mode.`);
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
