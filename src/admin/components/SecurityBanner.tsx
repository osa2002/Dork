/**
 * Enterprise Platform Administration - Security Banner
 * Domain: Platform Administration (Isolated from Shop Dashboard)
 */

import React from "react";
import { ShieldCheck, Lock, AlertTriangle, KeyRound } from "lucide-react";
import { useAdminStore } from "../store/adminStore";

export const SecurityBanner: React.FC = () => {
  const mfaVerified = useAdminStore((state) => state.mfaVerified);
  const user = useAdminStore((state) => state.user);
  const setMfaPromptOpen = useAdminStore((state) => state.setMfaPromptOpen);
  const alerts = useAdminStore((state) => state.alerts);

  const criticalAlertsCount = alerts.filter((a) => a.severity === "CRITICAL" && a.status === "ACTIVE").length;

  return (
    <div className="bg-slate-900/90 border-b border-slate-800/80 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-[11px]">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>ISOLATED PLATFORM CONSOLE</span>
        </div>

        <div className="hidden sm:flex items-center gap-1.5 text-slate-400">
          <Lock className="w-3.5 h-3.5 text-indigo-400" />
          <span>Session Encrypted & Audit Active</span>
        </div>

        {criticalAlertsCount > 0 && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 font-semibold animate-pulse">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            <span>{criticalAlertsCount} Critical Security Alert{criticalAlertsCount > 1 ? "s" : ""} Active</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        {mfaVerified ? (
          <span className="flex items-center gap-1 text-emerald-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            MFA Step-Up Verified
          </span>
        ) : (
          <button
            onClick={() => setMfaPromptOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-medium transition-colors cursor-pointer"
          >
            <KeyRound className="w-3.5 h-3.5 text-amber-400" />
            <span>Verify Step-Up MFA</span>
          </button>
        )}

        <div className="text-slate-400 font-mono text-[11px] hidden md:inline-block">
          Role: <span className="text-indigo-300 font-semibold">{user?.role || "GUEST"}</span>
        </div>
      </div>
    </div>
  );
};
