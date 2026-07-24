import { ControlPlaneContext } from "./ControlPlaneContext";

export interface EngineLifecycle {
  /**
   * Initializes the engine before any operation starts.
   */
  initialize?(ctx: ControlPlaneContext): Promise<void>;

  /**
   * Pre-execution hook for validation, sanity checking, and reserving resources.
   */
  preExecute?(ctx: ControlPlaneContext): Promise<void>;

  /**
   * Executes the core operational action associated with the engine.
   */
  execute?(ctx: ControlPlaneContext, input?: any): Promise<any>;

  /**
   * Post-execution hook for validation, publishing telemetry, or cleaning up resources.
   */
  postExecute?(ctx: ControlPlaneContext, result: any): Promise<void>;

  /**
   * Gracefully shuts down the engine, releasing handles or active connections.
   */
  shutdown?(): Promise<void>;
}
