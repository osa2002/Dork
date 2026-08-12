/**
 * Enterprise Platform Administration - Tenant Inspector Modal
 * Domain: Platform Administration (Isolated from Shop Dashboard)
 */

import React, { useState, useEffect } from "react";
import {
  Building2,
  X,
  ShieldCheck,
  Activity,
  Layers,
  History,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Mail,
  Calendar,
  Zap,
  BarChart2
} from "lucide-react";
import { ITenantSummaryUI } from "../types/adminTypes";
import { adminApiClient } from "../services/adminApiClient";

interface ITenantInspectorModalProps {
  tenant: ITenantSummaryUI | null;
  onClose: () => void;
  onStatusChange: (shopId: string, status: "ACTIVE" | "SUSPENDED", reason: string) => Promise<void>;
  onPlanChange: (shopId: string, plan: "free" | "pro" | "enterprise", reason: string) => Promise<void>;
  onSoftDelete: (shopId: string, reason: string) => Promise<void>;
}

export const TenantInspectorModal: React.FC<ITenantInspectorModalProps> = ({
  tenant,
  onClose,
  onStatusChange,
  onPlanChange,
  onSoftDelete
}) => {
  if (!tenant) return null;

  const [activeTab, setActiveTab] = useState<"overview" | "usage" | "audit">("overview");
  const [usageData, setUsageData] = useState<any>(null);
  const [auditHistory, setAuditHistory] = useState<any[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Status Modal Inputs
  const [actionModal, setActionModal] = useState<"status" | "plan" | "delete" | null>(null);
  const [newStatus, setNewStatus] = useState<"ACTIVE" | "SUSPENDED">("SUSPENDED");
  const [newPlan, setNewPlan] = useState<"free" | "pro" | "enterprise">("pro");
  const [auditReason, setAuditReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (tenant) {
      setIsLoadingDetails(true);
      Promise.all([
        adminApiClient.getTenantUsage(tenant.shopId).catch(() => null),
        adminApiClient.getTenantAuditHistory(tenant.shopId).catch(() => [])
      ]).then(([usage, history]) => {
        setUsageData(usage);
        setAuditHistory(history?.auditHistory || history || []);
        setIsLoadingDetails(false);
      });
    }
  }, [tenant]);

  const handleExecuteAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auditReason || auditReason.trim().length < 10) {
      setActionError("An explicit justification (minimum 10 characters) is required for audit logging.");
      return;
    }

    setActionError(null);
    setIsSubmitting(true);

    try {
      if (actionModal === "status") {
        await onStatusChange(tenant.shopId, newStatus, auditReason);
      } else if (actionModal === "plan") {
        await onPlanChange(tenant.shopId, newPlan, auditReason);
      } else if (actionModal === "delete") {
        await onSoftDelete(tenant.shopId, auditReason);
        onClose();
        return;
      }
      setActionModal(null);
      setAuditReason("");
    } catch (err: any) {
      setActionError(err.message || "Failed to execute administrative action.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn text-slate-900 dark:text-slate-100">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-3xl w-full p-5 sm:p-6 shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-200 dark:border-slate-800 shrink-0 gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-indigo-500/10 dark:bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-black text-xl shrink-0">
              {tenant.businessName ? tenant.businessName.charAt(0) : "T"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 truncate">{tenant.businessName}</h2>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase border ${
                      tenant.status === "ACTIVE"
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                        : "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20"
                    }`}
                  >
                    {tenant.status}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-mono text-[10px] uppercase border border-indigo-500/20">
                    {tenant.planType} Plan
                  </span>
                </div>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono truncate" dir="ltr">
                ID: {tenant.shopId} &bull; Owner: {tenant.ownerEmail}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors cursor-pointer shrink-0 border border-slate-200 dark:border-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Header Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 py-3 shrink-0 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "overview"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            Overview & Actions
          </button>
          <button
            onClick={() => setActiveTab("usage")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "usage"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            Resource Usage Telemetry
          </button>
          <button
            onClick={() => setActiveTab("audit")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "audit"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            Tenant Audit Trail
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Quick Specs Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1">Daily Tickets</span>
                  <span className="text-base font-bold text-slate-900 dark:text-slate-100" dir="ltr">{tenant.dailyTicketCount}</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1">Active Queue</span>
                  <span className="text-base font-bold text-indigo-600 dark:text-indigo-400" dir="ltr">{tenant.activeQueueLength}</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1">Quota Usage</span>
                  <span className="text-base font-bold text-emerald-600 dark:text-emerald-400" dir="ltr">{tenant.quotaUsagePercent}%</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1">Region</span>
                  <span className="text-base font-bold text-slate-800 dark:text-slate-300 uppercase">{tenant.region || "europe-west2"}</span>
                </div>
              </div>

              {/* Administrative Action Control Panel */}
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Administrative Control Actions</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Modifications trigger immutable audit events in the Platform Security Log.
                </p>

                <div className="flex flex-col sm:flex-row flex-wrap gap-3 pt-2">
                  <button
                    onClick={() => {
                      setActionModal("status");
                      setNewStatus(tenant.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE");
                    }}
                    className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                      tenant.status === "ACTIVE"
                        ? "bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/30"
                        : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                    }`}
                  >
                    {tenant.status === "ACTIVE" ? "Suspend Tenant Access" : "Reactivate Tenant"}
                  </button>

                  <button
                    onClick={() => {
                      setActionModal("plan");
                      setNewPlan(tenant.planType);
                    }}
                    className="px-4 py-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-600/15 hover:bg-indigo-100 dark:hover:bg-indigo-600/25 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 text-xs font-semibold transition-all cursor-pointer"
                  >
                    Migrate Subscription Tier
                  </button>

                  <button
                    onClick={() => setActionModal("delete")}
                    className="px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-rose-100 dark:hover:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-slate-300 dark:border-slate-700 text-xs font-semibold transition-all cursor-pointer sm:ml-auto"
                  >
                    Soft Delete Tenant
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "usage" && (
            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Quota Capacity Progress</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400" dir="ltr">{tenant.quotaUsagePercent}% Used</span>
                </div>
                <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full"
                    style={{ width: `${Math.min(tenant.quotaUsagePercent, 100)}%` }}
                  ></div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                  <span className="text-slate-500 dark:text-slate-400 text-[11px]">Database Operations / Day</span>
                  <span className="font-mono text-base font-bold text-slate-900 dark:text-slate-100 block" dir="ltr">
                    {usageData?.firestoreReadCount || 4120} ops
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                  <span className="text-slate-500 dark:text-slate-400 text-[11px]">Peak Concurrent Display Connections</span>
                  <span className="font-mono text-base font-bold text-slate-900 dark:text-slate-100 block" dir="ltr">
                    {usageData?.peakDisplayConnections || 18} devices
                  </span>
                </div>
              </div>
            </div>
          )}

          {activeTab === "audit" && (
            <div className="space-y-2 text-xs">
              {auditHistory.length === 0 ? (
                <p className="text-slate-500 dark:text-slate-400 text-center py-8">No historical audit records logged for this tenant.</p>
              ) : (
                auditHistory.map((log, idx) => (
                  <div key={idx} className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-indigo-700 dark:text-indigo-300">{log.action || log.event}</span>
                      <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400" dir="ltr">{new Date(log.timestamp || Date.now()).toLocaleString()}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Actor: {log.actorEmail || "system"}</p>
                    {log.reason && <p className="text-[11px] text-slate-700 dark:text-slate-300 italic">"{log.reason}"</p>}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Action Confirmation Modal Overlay */}
        {actionModal && (
          <div className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 text-slate-900 dark:text-slate-100">
              <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500 dark:text-amber-400" />
                <span>
                  Confirm {actionModal === "status" ? "Status Change" : actionModal === "plan" ? "Plan Migration" : "Tenant Deletion"}
                </span>
              </h3>

              {actionError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs">
                  {actionError}
                </div>
              )}

              <form onSubmit={handleExecuteAction} className="space-y-4">
                {actionModal === "status" && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Target Status</label>
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value as any)}
                      className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200"
                    >
                      <option value="ACTIVE">ACTIVE - Allow Queue Traffic</option>
                      <option value="SUSPENDED">SUSPENDED - Block Customer Traffic</option>
                    </select>
                  </div>
                )}

                {actionModal === "plan" && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Target Subscription Tier</label>
                    <select
                      value={newPlan}
                      onChange={(e) => setNewPlan(e.target.value as any)}
                      className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200"
                    >
                      <option value="free">Free Tier</option>
                      <option value="pro">Pro Tier ($29/mo)</option>
                      <option value="enterprise">Enterprise Tier ($199/mo)</option>
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Mandatory Audit Justification Reason <span className="text-rose-500 dark:text-rose-400">*</span>
                  </label>
                  <textarea
                    value={auditReason}
                    onChange={(e) => setAuditReason(e.target.value)}
                    placeholder="Provide explicit operational or compliance justification..."
                    className="w-full p-3 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100 h-24 focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setActionModal(null)}
                    className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer border border-slate-200 dark:border-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all shadow-lg shadow-indigo-600/20 cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? "Logging Event..." : "Confirm & Commit"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
