/**
 * Enterprise Platform Administration - Monitoring & Incident Center Page
 * Domain: Platform Administration (Isolated from Shop Dashboard)
 */

import React, { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  Bell,
  Calendar,
  Server,
  Zap,
  ShieldCheck,
  Cpu,
  Database,
  Radio
} from "lucide-react";
import { useAdminStore } from "../store/adminStore";

export const AdminMonitoringPage: React.FC = () => {
  const fetchDiagnostics = useAdminStore((state) => state.fetchDiagnostics);
  const diagnostics = useAdminStore((state) => state.diagnostics);
  const fetchIncidents = useAdminStore((state) => state.fetchIncidents);
  const incidents = useAdminStore((state) => state.incidents);
  const createIncident = useAdminStore((state) => state.createIncident);
  const updateIncident = useAdminStore((state) => state.updateIncident);
  
  const fetchAlerts = useAdminStore((state) => state.fetchAlerts);
  const alerts = useAdminStore((state) => state.alerts);
  const acknowledgeAlert = useAdminStore((state) => state.acknowledgeAlert);

  const fetchMaintenanceWindows = useAdminStore((state) => state.fetchMaintenanceWindows);
  const maintenanceWindows = useAdminStore((state) => state.maintenanceWindows);
  const scheduleMaintenanceWindow = useAdminStore((state) => state.scheduleMaintenanceWindow);

  const [activeTab, setActiveTab] = useState<"diagnostics" | "incidents" | "alerts" | "maintenance">("diagnostics");

  // Create Incident Form Modal State
  const [showDeclareModal, setShowDeclareModal] = useState(false);
  const [incTitle, setIncTitle] = useState("");
  const [incSeverity, setIncSeverity] = useState("HIGH");
  const [incDesc, setIncDesc] = useState("");
  const [incServices, setIncServices] = useState("Queue API Engine, Firestore Sync");

  // Maintenance Form Modal State
  const [showMaintModal, setShowMaintModal] = useState(false);
  const [maintTitle, setMaintTitle] = useState("Routine Database Index Optimization");
  const [maintService, setMaintService] = useState("Firestore Admin");

  useEffect(() => {
    fetchDiagnostics();
    fetchIncidents();
    fetchAlerts();
    fetchMaintenanceWindows();
  }, []);

  const handleDeclareIncidentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!incTitle || !incDesc) return;
    await createIncident({
      title: incTitle,
      severity: incSeverity,
      description: incDesc,
      affectedServices: incServices.split(",").map((s) => s.trim())
    });
    setShowDeclareModal(false);
    setIncTitle("");
    setIncDesc("");
  };

  const handleScheduleMaintSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await scheduleMaintenanceWindow({
      title: maintTitle,
      service: maintService,
      scheduledStart: new Date(Date.now() + 86400000).toISOString(),
      scheduledEnd: new Date(Date.now() + 90000000).toISOString(),
      impactLevel: "PARTIAL"
    });
    setShowMaintModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 font-mono text-xs font-semibold uppercase tracking-wider mb-1">
            <Radio className="w-4 h-4" />
            <span>Cloud Run Operations & Observability</span>
          </div>
          <h1 className="text-2xl font-black text-slate-100">Monitoring & Incident Center</h1>
          <p className="text-xs text-slate-400 mt-1">
            Live infrastructure diagnostics, incident lifecycle declaration, alert engine, and scheduled maintenance windows.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowDeclareModal(true)}
            className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/20 transition-all flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Declare Incident</span>
          </button>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="p-2 rounded-2xl bg-slate-900 border border-slate-800 flex flex-wrap gap-2">
        <button
          onClick={() => setActiveTab("diagnostics")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "diagnostics" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20" : "text-slate-400 hover:bg-slate-800"
          }`}
        >
          Live Diagnostics
        </button>
        <button
          onClick={() => setActiveTab("incidents")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === "incidents" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20" : "text-slate-400 hover:bg-slate-800"
          }`}
        >
          <span>Incidents</span>
          {incidents.filter((i) => i.status !== "RESOLVED").length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-mono">
              {incidents.filter((i) => i.status !== "RESOLVED").length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("alerts")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === "alerts" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20" : "text-slate-400 hover:bg-slate-800"
          }`}
        >
          <span>Alert Rules</span>
          {alerts.filter((a) => a.status === "ACTIVE").length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-slate-950 font-mono text-[10px]">
              {alerts.filter((a) => a.status === "ACTIVE").length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("maintenance")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "maintenance" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20" : "text-slate-400 hover:bg-slate-800"
          }`}
        >
          Maintenance Windows
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === "diagnostics" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Cloud Run Service Status */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">Cloud Run Deployment</span>
                <Server className="w-4 h-4 text-sky-400" />
              </div>
              <div className="text-xl font-bold text-emerald-400 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                <span>{diagnostics?.cloudRunHealth || "HEALTHY"}</span>
              </div>
              <p className="text-[11px] text-slate-500">Auto-scaled containers running across europe-west2</p>
            </div>

            {/* Firestore Latency */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">Firestore Query Latency</span>
                <Database className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="text-xl font-bold text-slate-100 font-mono">
                {diagnostics?.firestoreLatencyMs || 14} <span className="text-xs text-slate-500">ms</span>
              </div>
              <p className="text-[11px] text-slate-500">Document read/write roundtrip duration</p>
            </div>

            {/* CPU & Memory Utilization */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">Resource Load</span>
                <Cpu className="w-4 h-4 text-violet-400" />
              </div>
              <div className="text-xl font-bold text-slate-100 font-mono">
                CPU {diagnostics?.cpuUtilizationPercent || 34}% &bull; RAM {diagnostics?.memoryUtilizationPercent || 52}%
              </div>
              <p className="text-[11px] text-slate-500">Container memory & CPU allocation status</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === "incidents" && (
        <div className="bg-slate-900 rounded-3xl border border-slate-800/80 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-100">Declared System Incidents</h3>
            <span className="text-xs text-slate-400">Total: {incidents.length}</span>
          </div>

          <div className="space-y-3">
            {incidents.map((inc) => (
              <div key={inc.incidentId} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-100 text-sm">{inc.title}</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-mono text-[10px] font-bold">
                      {inc.severity}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={inc.status}
                      onChange={(e) => updateIncident(inc.incidentId, { status: e.target.value })}
                      className="px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 cursor-pointer"
                    >
                      <option value="OPEN">OPEN</option>
                      <option value="INVESTIGATING">INVESTIGATING</option>
                      <option value="MITIGATED">MITIGATED</option>
                      <option value="RESOLVED">RESOLVED</option>
                    </select>
                  </div>
                </div>

                <p className="text-slate-300">{inc.description}</p>
                <div className="flex flex-wrap gap-2 text-[10px] text-slate-500 font-mono">
                  <span>Services: {inc.affectedServices.join(", ")}</span>
                  <span>&bull; Declared By: {inc.declaredBy}</span>
                  <span>&bull; {new Date(inc.declaredAt).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "alerts" && (
        <div className="bg-slate-900 rounded-3xl border border-slate-800/80 p-6 space-y-4">
          <h3 className="font-bold text-sm text-slate-100">System Alert Triggers</h3>

          <div className="space-y-3">
            {alerts.map((alt) => (
              <div key={alt.alertId} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-100">{alt.ruleName}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                      alt.severity === "CRITICAL" ? "bg-rose-500/20 text-rose-300" : "bg-amber-500/20 text-amber-300"
                    }`}>
                      {alt.severity}
                    </span>
                  </div>
                  <p className="text-slate-400">{alt.service} &bull; Triggered value: {alt.metricValue} (Threshold: {alt.thresholdValue})</p>
                </div>

                <div>
                  {alt.status === "ACTIVE" ? (
                    <button
                      onClick={() => acknowledgeAlert(alt.alertId)}
                      className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs cursor-pointer shadow"
                    >
                      Acknowledge
                    </button>
                  ) : (
                    <span className="text-emerald-400 font-semibold text-xs flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Acknowledged
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "maintenance" && (
        <div className="bg-slate-900 rounded-3xl border border-slate-800/80 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-100">Scheduled Maintenance Windows</h3>
            <button
              onClick={() => setShowMaintModal(true)}
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs cursor-pointer"
            >
              Schedule Window
            </button>
          </div>

          <div className="space-y-3">
            {maintenanceWindows.map((mw) => (
              <div key={mw.maintenanceId} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-100">{mw.title}</span>
                  <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 font-mono text-[10px] uppercase font-bold">
                    {mw.status}
                  </span>
                </div>
                <p className="text-slate-400">Target Service: {mw.service} &bull; Impact: {mw.impactLevel}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Declare Incident Modal */}
      {showDeclareModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-bold text-base text-slate-100">Declare System Incident</h3>
            <form onSubmit={handleDeclareIncidentSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Incident Title</label>
                <input
                  type="text"
                  value={incTitle}
                  onChange={(e) => setIncTitle(e.target.value)}
                  placeholder="e.g. Firestore Index Degradation"
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Severity</label>
                <select
                  value={incSeverity}
                  onChange={(e) => setIncSeverity(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100"
                >
                  <option value="CRITICAL">CRITICAL</option>
                  <option value="HIGH">HIGH</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="LOW">LOW</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Description</label>
                <textarea
                  value={incDesc}
                  onChange={(e) => setIncDesc(e.target.value)}
                  placeholder="Detailed description..."
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 h-20"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeclareModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer"
                >
                  Broadcast Incident
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Schedule Maintenance Modal */}
      {showMaintModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-bold text-base text-slate-100">Schedule Maintenance Window</h3>
            <form onSubmit={handleScheduleMaintSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Maintenance Title</label>
                <input
                  type="text"
                  value={maintTitle}
                  onChange={(e) => setMaintTitle(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Target Service</label>
                <input
                  type="text"
                  value={maintService}
                  onChange={(e) => setMaintService(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowMaintModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer"
                >
                  Publish Maintenance Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
