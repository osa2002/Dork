import { ClientLogger } from "../../../lib/clientLogger";

interface ActionOptions<T> {
  onSuccess?: (result: T) => void;
  onFailure?: (err: any) => void;
  clearErrorAfterMs?: number;
  successStateKey?: string;
  successStateValue?: any;
}

/**
 * Centralized Store Action Orchestrator for Phase 4.2.
 * Ensures consistent loading state lifecycle, standardized error capture in ClientLogger,
 * user-facing error message populating, state recovery mechanisms, and optional automatic
 * transient error clearing.
 */
export async function runStoreAction<T>(
  actionName: string,
  set: (state: Partial<any>) => void,
  loadingKey: string,
  errorKey: string,
  asyncFn: () => Promise<T>,
  options?: ActionOptions<T>
): Promise<T | null> {
  // Set consistent initial execution state
  const initialPatch: Record<string, any> = {
    [loadingKey]: true,
    [errorKey]: null,
  };
  if (options?.successStateKey) {
    initialPatch[options.successStateKey] = false;
  }
  set(initialPatch);

  try {
    ClientLogger.debug(`[Zustand Action Initiated] ${actionName}`);
    const result = await asyncFn();
    ClientLogger.debug(`[Zustand Action Success] ${actionName}`);

    const successPatch: Record<string, any> = {
      [loadingKey]: false,
    };
    if (options?.successStateKey) {
      successPatch[options.successStateKey] = options.successStateValue !== undefined ? options.successStateValue : true;
    }
    set(successPatch);

    if (options?.onSuccess) {
      options.onSuccess(result);
    }

    return result;
  } catch (err: any) {
    ClientLogger.error(`[Zustand Action Error] ${actionName} failed:`, err);
    
    // Standardize error formats for consistent client-side messaging
    const displayError = err.message || "An unexpected system error occurred. Please try again.";
    
    const errorPatch: Record<string, any> = {
      [loadingKey]: false,
      [errorKey]: displayError,
    };
    if (options?.successStateKey) {
      errorPatch[options.successStateKey] = false;
    }
    set(errorPatch);

    if (options?.onFailure) {
      options.onFailure(err);
    }

    // Auto-recovery / Auto-clear mechanism for transient alert warnings
    if (options?.clearErrorAfterMs) {
      setTimeout(() => {
        set({ [errorKey]: null });
      }, options.clearErrorAfterMs);
    }

    return null;
  }
}
