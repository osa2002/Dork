/**
 * Enterprise Platform Administration - Platform Config & Feature Flags Page
 * Domain: Platform Administration (Isolated from Shop Dashboard)
 */

import React, { useEffect, useState } from "react";
import {
  Sliders,
  SlidersHorizontal,
  ShieldCheck,
  AlertOctagon,
  CheckCircle2,
  Lock,
  RefreshCw,
  Power
} from "lucide-react";
import { useAdminStore } from "../store/adminStore";

export const AdminConfigPage: React.FC = () => {
  const fetchPlatformConfig = useAdminStore((state) => state.fetchPlatformConfig);
  const platformConfig = useAdminStore((state) => state.platformConfig);
  const updatePlatformConfig = useAdminStore((state) => state.updatePlatformConfig);
  
  const featureFlags = useAdminStore((state) => state.featureFlags);
  const toggleFeatureFlag = useAdminStore((state) => state.toggleFeatureFlag);

  // Dual Confirmation Modal
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [rateLimit, setRateLimit] = useState(1000);
  const [maintMode, setMaintMode] = useState(false);
  const [auditReason, setAuditReason] = useState("");
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchPlatformConfig();
  }, []);

  useEffect(() => {
    if (platformConfig) {
      setRateLimit(platformConfig.rateLimitRequestsPerMin || 1000);
      setMaintMode(!!platformConfig.globalMaintenanceMode);
    }
  }, [platformConfig]);

  const handleSaveConfigSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmPhrase.trim().toUpperCase() !== "COMMIT CONFIG") return;
    setIsSubmitting(true);
    await updatePlatformConfig(
      {
        rateLimitRequestsPerMin: rateLimit,
        globalMaintenanceMode: maintMode
      },
      auditReason
    );
    setIsSubmitting(false);
    setShowConfirmModal(false);
    setConfirmPhrase("");
    setAuditReason("");
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 font-mono text-xs font-semibold uppercase tracking-wider mb-1">
            <Sliders className="w-4 h-4" />
            <span>Global Control Engine & Feature Flags</span>
          </div>
          <h1 className="text-2xl font-black text-slate-100">System Configuration</h1>
          <p className="text-xs text-slate-400 mt-1">
            Configure platform parameters, feature flag rollouts, and double-confirmation emergency controls.
          </p>
        </div>

        <button
          onClick={() => setShowConfirmModal(true)}
          className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 cursor-pointer"
        >
          Modify System Config
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Current Active Config Summary */}
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Active Global Parameters</span>
          </h3>

          <div className="space-y-3 text-xs">
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400 font-medium">Rate Limit Ceiling</span>
              <span className="font-mono font-bold text-indigo-400">{platformConfig?.rateLimitRequestsPerMin || rateLimit} req/min</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400 font-medium">Global Maintenance Lockout</span>
              <span className={`font-mono font-bold ${maintMode ? "text-rose-400" : "text-emerald-400"}`}>
                {maintMode ? "ACTIVE (LOCKOUT)" : "INACTIVE (NORMAL)"}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400 font-medium">Config Schema Version</span>
              <span className="font-mono text-slate-200">v{platformConfig?.configVersion || 1}</span>
            </div>
          </div>
        </div>

        {/* Feature Flags Section */}
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-indigo-400" />
            <span>Feature Flag Manager</span>
          </h3>

          <div className="space-y-3">
            {featureFlags.map((flag) => (
              <div key={flag.flagKey} className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-100">{flag.name}</span>
                  <button
                    onClick={() => toggleFeatureFlag(flag.flagKey, !flag.enabled)}
                    className={`px-3 py-1 rounded-full font-mono text-[10px] font-bold cursor-pointer ${
                      flag.enabled ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "bg-slate-800 text-slate-500"
                    }`}
                  >
                    {flag.enabled ? "ENABLED" : "DISABLED"}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">{flag.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Dual Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 text-slate-100">
            <h3 className="font-bold text-base flex items-center gap-2 text-amber-400">
              <AlertOctagon className="w-5 h-5" />
              <span>Double-Confirmation Configuration Commit</span>
            </h3>

            <form onSubmit={handleSaveConfigSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Requests Rate Limit Ceiling (req/min)</label>
                <input
                  type="number"
                  value={rateLimit}
                  onChange={(e) => setRateLimit(parseInt(e.target.value, 10))}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100"
                  required
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="maintChk"
                  checked={maintMode}
                  onChange={(e) => setMaintMode(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-800 text-indigo-600 focus:ring-0"
                />
                <label htmlFor="maintChk" className="text-slate-300 font-semibold cursor-pointer">
                  Activate Platform Emergency Maintenance Mode
                </label>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Audit Justification</label>
                <input
                  type="text"
                  value={auditReason}
                  onChange={(e) => setAuditReason(e.target.value)}
                  placeholder="Reason for configuration change..."
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100"
                  required
                />
              </div>

              <div>
                <label className="block text-amber-300 mb-1 font-bold">
                  Type 'COMMIT CONFIG' to confirm:
                </label>
                <input
                  type="text"
                  value={confirmPhrase}
                  onChange={(e) => setConfirmPhrase(e.target.value)}
                  placeholder="COMMIT CONFIG"
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 font-mono tracking-widest text-center"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || confirmPhrase.trim().toUpperCase() !== "COMMIT CONFIG"}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer disabled:opacity-40"
                >
                  {isSubmitting ? "Committing..." : "Commit Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
