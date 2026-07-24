/**
 * Enterprise Platform Administration - Enterprise Security Center Page
 * Domain: Platform Administration (Isolated from Shop Dashboard)
 */

import React, { useEffect, useState } from "react";
import {
  ShieldCheck,
  Lock,
  KeyRound,
  ShieldAlert,
  Smartphone,
  Users,
  RefreshCw,
  Trash2,
  XCircle,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  UserCheck,
  Plus
} from "lucide-react";
import { useAdminStore } from "../store/adminStore";

export const AdminSecurityPage: React.FC = () => {
  const fetchSecurityOverview = useAdminStore((state) => state.fetchSecurityOverview);
  const activeSessions = useAdminStore((state) => state.activeSessions);
  const revokeSession = useAdminStore((state) => state.revokeSession);
  const revokeAllUserSessions = useAdminStore((state) => state.revokeAllUserSessions);
  const failedLoginAnalytics = useAdminStore((state) => state.failedLoginAnalytics);
  const suspiciousActivities = useAdminStore((state) => state.suspiciousActivities);
  const updateSuspiciousActivity = useAdminStore((state) => state.updateSuspiciousActivity);
  const devices = useAdminStore((state) => state.devices);
  const updateDeviceStatus = useAdminStore((state) => state.updateDeviceStatus);
  const roleAssignments = useAdminStore((state) => state.roleAssignments);
  const updateRoleAssignment = useAdminStore((state) => state.updateRoleAssignment);
  const apiKeys = useAdminStore((state) => state.apiKeys);
  const createApiKey = useAdminStore((state) => state.createApiKey);
  const revokeApiKey = useAdminStore((state) => state.revokeApiKey);
  const secretRotations = useAdminStore((state) => state.secretRotations);
  const triggerSecretRotation = useAdminStore((state) => state.triggerSecretRotation);

  const [activeTab, setActiveTab] = useState<"sessions" | "failed_logins" | "threats" | "devices" | "rbac" | "keys" | "secrets">("sessions");

  // Create Key Modal State
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [keyName, setKeyName] = useState("External SIEM Integration Key");

  useEffect(() => {
    fetchSecurityOverview();
  }, []);

  const handleCreateKeySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyName) return;
    await createApiKey(keyName, ["audit:read", "metrics:read_system"]);
    setShowKeyModal(false);
    setKeyName("");
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 font-mono text-xs font-semibold uppercase tracking-wider mb-1">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Identity, RBAC & Threat Protection Engine</span>
          </div>
          <h1 className="text-2xl font-black text-slate-100">Enterprise Security Center</h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage user sessions, threat detection, device governance, RBAC role matrices, API key lifecycle, and KMS secret rotations.
          </p>
        </div>

        <button
          onClick={() => fetchSecurityOverview()}
          className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors flex items-center gap-2 border border-slate-700 cursor-pointer shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
          <span>Sync Security State</span>
        </button>
      </div>

      {/* Tabs Navigation */}
      <div className="p-2 rounded-2xl bg-slate-900 border border-slate-800 flex flex-wrap gap-2 text-xs">
        <button
          onClick={() => setActiveTab("sessions")}
          className={`px-3.5 py-2 rounded-xl font-bold transition-all cursor-pointer ${
            activeTab === "sessions" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:bg-slate-800"
          }`}
        >
          Active Sessions ({activeSessions.length})
        </button>
        <button
          onClick={() => setActiveTab("failed_logins")}
          className={`px-3.5 py-2 rounded-xl font-bold transition-all cursor-pointer ${
            activeTab === "failed_logins" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:bg-slate-800"
          }`}
        >
          Login Analytics
        </button>
        <button
          onClick={() => setActiveTab("threats")}
          className={`px-3.5 py-2 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === "threats" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:bg-slate-800"
          }`}
        >
          <span>Threat Alerts</span>
          {suspiciousActivities.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-mono">
              {suspiciousActivities.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("devices")}
          className={`px-3.5 py-2 rounded-xl font-bold transition-all cursor-pointer ${
            activeTab === "devices" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:bg-slate-800"
          }`}
        >
          Device Inventory ({devices.length})
        </button>
        <button
          onClick={() => setActiveTab("rbac")}
          className={`px-3.5 py-2 rounded-xl font-bold transition-all cursor-pointer ${
            activeTab === "rbac" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:bg-slate-800"
          }`}
        >
          RBAC Roles
        </button>
        <button
          onClick={() => setActiveTab("keys")}
          className={`px-3.5 py-2 rounded-xl font-bold transition-all cursor-pointer ${
            activeTab === "keys" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:bg-slate-800"
          }`}
        >
          API Keys ({apiKeys.length})
        </button>
        <button
          onClick={() => setActiveTab("secrets")}
          className={`px-3.5 py-2 rounded-xl font-bold transition-all cursor-pointer ${
            activeTab === "secrets" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:bg-slate-800"
          }`}
        >
          KMS Secret Rotation
        </button>
      </div>

      {/* Tab 1: Active Sessions */}
      {activeTab === "sessions" && (
        <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-100">Live Authenticated Sessions</h3>
          </div>

          <div className="space-y-3">
            {activeSessions.length === 0 ? (
              <p className="text-slate-500 text-xs text-center py-6">No active sessions query returned.</p>
            ) : (
              activeSessions.map((session) => (
                <div key={session.sessionId} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-100">{session.userEmail}</span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-mono border border-emerald-500/20 font-bold">
                        {session.deviceType}
                      </span>
                    </div>
                    <p className="text-slate-400 text-[11px] font-mono">
                      IP: {session.ipAddress} &bull; Location: {session.location} &bull; UserAgent: {session.userAgent}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => revokeSession(session.sessionId)}
                      className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 font-semibold text-xs border border-rose-500/30 cursor-pointer flex items-center gap-1"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Revoke Session</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Failed Login Analytics */}
      {activeTab === "failed_logins" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
            <h3 className="font-bold text-sm text-slate-100">Targeted Admin Accounts (24h)</h3>
            <div className="space-y-2 text-xs">
              {failedLoginAnalytics?.topTargetedAccounts.map((acc, idx) => (
                <div key={idx} className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <span className="font-mono text-slate-200">{acc.email}</span>
                  <span className="font-bold text-rose-400 font-mono">{acc.attempts} attempts</span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
            <h3 className="font-bold text-sm text-slate-100">Top Suspicious Origin IPs</h3>
            <div className="space-y-2 text-xs">
              {failedLoginAnalytics?.topOriginIps.map((ip, idx) => (
                <div key={idx} className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="font-mono text-slate-200 block">{ip.ipAddress}</span>
                    <span className="text-[10px] text-slate-500">{ip.location}</span>
                  </div>
                  <span className="font-bold text-amber-400 font-mono">{ip.attempts} attempts</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Threat Alerts */}
      {activeTab === "threats" && (
        <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6 space-y-4">
          <h3 className="font-bold text-sm text-slate-100">AI Suspicious Activity & Threat Detections</h3>

          <div className="space-y-3">
            {suspiciousActivities.map((act) => (
              <div key={act.activityId} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-rose-400" />
                    <span className="font-bold text-slate-100">{act.type}</span>
                    <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-mono text-[10px] font-bold">
                      {act.severity}
                    </span>
                  </div>
                  <span className="text-slate-500 font-mono text-[10px]">{new Date(act.detectedAt).toLocaleString()}</span>
                </div>

                <p className="text-slate-300">{act.description}</p>
                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                  <span>Target: {act.userEmail || "System Wide"} &bull; IP: {act.ipAddress} ({act.location})</span>
                  <button
                    onClick={() => updateSuspiciousActivity(act.activityId, "RESOLVED", "Dismissed by admin")}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer"
                  >
                    Mark Resolved
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Devices */}
      {activeTab === "devices" && (
        <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6 space-y-4">
          <h3 className="font-bold text-sm text-slate-100">Registered Admin Devices</h3>

          <div className="space-y-3">
            {devices.map((dev) => (
              <div key={dev.deviceId} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-indigo-400" />
                    <span className="font-bold text-slate-100">{dev.deviceName}</span>
                    <span className="text-[10px] text-slate-400 font-mono">({dev.os} &bull; {dev.browser})</span>
                  </div>
                  <p className="text-slate-400 text-[11px]">User: {dev.userEmail} &bull; Last IP: {dev.lastIpAddress}</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateDeviceStatus(dev.deviceId, dev.status === "APPROVED" ? "BLOCKED" : "APPROVED", true)}
                    className={`px-3 py-1.5 rounded-xl font-semibold text-xs transition-colors cursor-pointer border ${
                      dev.status === "APPROVED"
                        ? "bg-rose-500/10 text-rose-300 border-rose-500/30"
                        : "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                    }`}
                  >
                    {dev.status === "APPROVED" ? "Block Device" : "Approve Device"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 5: RBAC Roles */}
      {activeTab === "rbac" && (
        <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6 space-y-4">
          <h3 className="font-bold text-sm text-slate-100">Role Assignments & Permission Matrix</h3>

          <div className="space-y-3">
            {roleAssignments.map((role) => (
              <div key={role.adminId} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="font-bold text-slate-100">{role.userEmail}</div>
                  <div className="text-[11px] text-indigo-400 font-mono mt-0.5">Role: {role.role}</div>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={role.role}
                    onChange={(e) => updateRoleAssignment(role.adminId, e.target.value)}
                    className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 cursor-pointer"
                  >
                    <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                    <option value="PLATFORM_OPERATOR">PLATFORM_OPERATOR</option>
                    <option value="COMPLIANCE_OFFICER">COMPLIANCE_OFFICER</option>
                    <option value="SUPPORT_ENGINEER">SUPPORT_ENGINEER</option>
                    <option value="FINANCE_AUDITOR">FINANCE_AUDITOR</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 6: API Keys */}
      {activeTab === "keys" && (
        <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-100">Platform API Key Credentials</h3>
            <button
              onClick={() => setShowKeyModal(true)}
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Generate API Key</span>
            </button>
          </div>

          <div className="space-y-3">
            {apiKeys.map((key) => (
              <div key={key.keyId} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="font-bold text-slate-100">{key.name}</div>
                  <div className="text-[11px] text-slate-500 font-mono">Prefix: {key.keyPrefix} &bull; Created: {new Date(key.createdAt).toLocaleDateString()}</div>
                </div>

                <button
                  onClick={() => revokeApiKey(key.keyId)}
                  className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 font-semibold text-xs border border-rose-500/30 cursor-pointer"
                >
                  Revoke Key
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 7: Secrets */}
      {activeTab === "secrets" && (
        <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6 space-y-4">
          <h3 className="font-bold text-sm text-slate-100">KMS Secret Rotation Status</h3>

          <div className="space-y-3">
            {secretRotations.map((sec) => (
              <div key={sec.secretId} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="font-bold text-slate-100">{sec.secretName}</div>
                  <div className="text-[11px] text-slate-400 font-mono">Service: {sec.service} &bull; Interval: {sec.rotationIntervalDays} days</div>
                </div>

                <button
                  onClick={() => triggerSecretRotation(sec.secretId)}
                  className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs cursor-pointer"
                >
                  Trigger Rotation Now
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Key Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-bold text-base text-slate-100">Generate Platform API Key</h3>
            <form onSubmit={handleCreateKeySubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Key Identifier / Name</label>
                <input
                  type="text"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowKeyModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer"
                >
                  Generate & Issuance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
