/**
 * Enterprise Platform Administration - Feature Flag Guard Component
 * Domain: Platform Administration (Isolated from Shop Dashboard)
 */

import React, { ReactNode } from "react";
import { useAdminStore } from "../store/adminStore";
import { SlidersHorizontal } from "lucide-react";

export interface IFeatureFlagGuardProps {
  flagKey: string;
  fallback?: ReactNode;
  children: ReactNode;
}

export const FeatureFlagGuard: React.FC<IFeatureFlagGuardProps> = ({ flagKey, fallback, children }) => {
  const flags = useAdminStore((state) => state.featureFlags);
  const flag = flags.find((f) => f.flagKey === flagKey);
  const isEnabled = flag ? flag.enabled : true;

  if (!isEnabled) {
    if (fallback) return <>{fallback}</>;
    return (
      <div className="p-6 rounded-2xl border border-amber-500/20 bg-amber-500/5 text-amber-300 flex items-center gap-3 my-4">
        <SlidersHorizontal className="w-6 h-6 text-amber-400 shrink-0" />
        <div>
          <h4 className="font-semibold text-sm text-amber-200">Feature Flag Disabled</h4>
          <p className="text-xs text-amber-300/80 mt-0.5">
            The capability <code className="px-1.5 py-0.5 bg-amber-950/60 rounded text-amber-200 font-mono text-[11px]">{flagKey}</code> is currently toggled off by platform configuration.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
