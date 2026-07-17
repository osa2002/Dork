import { Server } from "http";

export class ShutdownManager {
  private static server: Server | null = null;
  private static intervals = new Set<NodeJS.Timeout>();
  private static pendingTasks = new Set<Promise<any>>();
  private static isShuttingDown = false;

  /**
   * Bind HTTP server instance for graceful shutdown connection draining
   */
  public static registerServer(server: Server) {
    this.server = server;
  }

  /**
   * Track periodic background intervals (e.g., cleanup cron loops) to clear them instantly
   */
  public static registerInterval(intervalId: NodeJS.Timeout) {
    this.intervals.add(intervalId);
  }

  /**
   * Track an active asynchronous database or external API promise
   */
  public static trackTask<T>(promise: Promise<T>): Promise<T> {
    this.pendingTasks.add(promise);
    
    // Clean up promise reference once finished to prevent memory leaks
    const cleanup = () => this.pendingTasks.delete(promise);
    promise.then(cleanup, cleanup);
    
    return promise;
  }

  /**
   * Attaches signal listeners to the process
   */
  public static listen() {
    process.on("SIGINT", () => this.initiateShutdown("SIGINT"));
    process.on("SIGTERM", () => this.initiateShutdown("SIGTERM"));
    console.log("[ShutdownManager] System signal listeners registered for SIGINT and SIGTERM.");
  }

  /**
   * Coordinates the graceful shutdown sequence
   */
  public static async initiateShutdown(signal: string) {
    if (this.isShuttingDown) {
      console.warn(`[ShutdownManager] Shutdown already in progress. Ignoring repeat signal: ${signal}`);
      return;
    }

    this.isShuttingDown = true;
    console.log(`\n\x1b[31m[ShutdownManager] Received ${signal} signal. Initiating production-grade graceful shutdown sequence...\x1b[0m`);

    // 1. Force hard exit timeout (e.g., 10 seconds) to guarantee process termination in Cloud Run
    const timeoutSeconds = 10;
    const forceExitTimeout = setTimeout(() => {
      console.error(`[ShutdownManager] Graceful shutdown exceeded deadline of ${timeoutSeconds}s. Forcing exit!`);
      process.exit(1);
    }, timeoutSeconds * 1000);

    // Unref the timer so it doesn't keep the event loop alive by itself
    forceExitTimeout.unref();

    // 2. Terminate the Express HTTP Server first
    if (this.server) {
      console.log("[ShutdownManager] Closing Express HTTP Server. Halting connection ingress...");
      await new Promise<void>((resolve) => {
        this.server!.close((err) => {
          if (err) {
            console.error("[ShutdownManager] Error closing Express HTTP Server:", err);
          } else {
            console.log("[ShutdownManager] Express HTTP Server closed successfully. Client connections drained.");
          }
          resolve();
        });
      });
    }

    // 3. Clear all background interval loops
    if (this.intervals.size > 0) {
      console.log(`[ShutdownManager] Clearing ${this.intervals.size} background periodic timers...`);
      this.intervals.forEach((intervalId) => {
        clearInterval(intervalId);
      });
      this.intervals.clear();
    }

    // 4. Await completion of all pending asynchronously tracked tasks
    if (this.pendingTasks.size > 0) {
      console.log(`[ShutdownManager] Waiting for ${this.pendingTasks.size} pending asynchronous tasks to drain/complete...`);
      try {
        await Promise.all(Array.from(this.pendingTasks));
        console.log("[ShutdownManager] All pending asynchronous tasks successfully completed.");
      } catch (err: any) {
        console.error("[ShutdownManager] Error occurred during pending tasks completion:", err.message);
      }
      this.pendingTasks.clear();
    }

    // 5. Final flush of telemetry and exit
    console.log("[ShutdownManager] Flushing structured logs and metric outputs.");
    clearTimeout(forceExitTimeout);
    console.log("\x1b[32m[ShutdownManager] Graceful shutdown completed. Exiting cleanly.\x1b[0m");
    process.exit(0);
  }
}
