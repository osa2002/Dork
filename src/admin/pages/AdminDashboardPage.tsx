/**
 * Enterprise Platform Administration - Operations & Health Dashboard Page
 * Domain: Platform Administration (Isolated from Shop Dashboard)
 */

import React, { useEffect } from "react";
import {
  Activity,
  Building2,
  Users,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Server,
  RefreshCw,
  ShieldCheck,
  BarChart3,
  TrendingUp,
  Clock,
  ArrowUpRight
} from "lucide-react";
import { useAdminStore } from "../store/adminStore";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar
} from "recharts";

interface IAdminDashboardPageProps {
  onNavigate: (path: string) => void;
}

export const AdminDashboardPage: React.FC<IAdminDashboardPageProps> = ({ onNavigate }) => {
  const systemMetrics = useAdminStore((state) => state.systemMetrics);
  const diagnostics = useAdminStore((state) => state.diagnostics);
  const fetchSystemMetrics = useAdminStore((state) => state.fetchSystemMetrics);
  const fetchDiagnostics = useAdminStore((state) => state.fetchDiagnostics);
  const fetchIncidents = useAdminStore((state) => state.fetchIncidents);
  const incidents = useAdminStore((state) => state.incidents);
  const alerts = useAdminStore((state) => state.alerts);

  useEffect(() => {
    fetchSystemMetrics();
    fetchDiagnostics();
    fetchIncidents();

    const interval = setInterval(() => {
      fetchSystemMetrics();
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  // Generate synthetic telemetry trend series for Recharts
  const telemetryData = [
    { time: "14:00", rps: 180, latencyMs: 38, errorRate: 0.01 },
    { time: "14:05", rps: 210, latencyMs: 40, errorRate: 0.01 },
    { time: "14:10", rps: 240, latencyMs: 45, errorRate: 0.02 },
    { time: "14:15", rps: 280, latencyMs: 52, errorRate: 0.03 },
    { time: "14:20", rps: 260, latencyMs: 42, errorRate: 0.01 },
    { time: "14:25", rps: 295, latencyMs: 39, errorRate: 0.02 },
    { time: "14:30", rps: 310, latencyMs: 41, errorRate: 0.01 },
    { time: "14:35", rps: systemMetrics?.systemThroughputRps || 285, latencyMs: systemMetrics?.latencyP95Ms || 42, errorRate: 0.01 }
  ];

  const queueDistribution = [
    { tier: "Enterprise", count: 48 },
    { tier: "Pro", count: 32 },
    { tier: "Free", count: 9 }
  ];

  const activeIncidents = incidents.filter((i) => i.status !== "RESOLVED");

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 p-6 rounded-3xl border border-slate-800 shadow-2xl relative overflow-hidden">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 font-mono text-xs font-semibold uppercase tracking-wider mb-1">
            <Zap className="w-4 h-4" />
            <span>Platform Telemetry Engine &bull; Live</span>
          </div>
          <h1 className="text-2xl font-black text-slate-100">Global Operations & Health Overview</h1>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Real-time monitoring for tenant queues, Cloud Run instances, system throughput, and SLA compliance.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => {
              fetchSystemMetrics();
              fetchDiagnostics();
            }}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors flex items-center gap-2 cursor-pointer border border-slate-700"
          >
            <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
            <span>Refresh Diagnostics</span>
          </button>
        </div>
      </div>

      {/* Primary Telemetry Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Active Tenants */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800/80 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400">Active Tenants</span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-100">
            {systemMetrics?.activeTenantsCount ?? 142}
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
            <span className="text-emerald-400 font-semibold flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> +12% this month
            </span>
            <span>Capacity 500</span>
          </div>
        </div>

        {/* Metric 2: Queued Customers */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800/80 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400">Active Queued Tickets</span>
            <div className="p-2 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-100">
            {systemMetrics?.totalQueuedCustomers ?? 89}
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
            <span className="text-violet-400 font-semibold">Across all shops</span>
            <span>Real-time Sync</span>
          </div>
        </div>

        {/* Metric 3: System Throughput */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800/80 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400">Throughput (RPS)</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-100">
            {systemMetrics?.systemThroughputRps ?? 245.8} <span className="text-xs text-slate-500 font-normal">req/s</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
            <span className="text-emerald-400 font-semibold">P95 Latency: {systemMetrics?.latencyP95Ms ?? 42}ms</span>
            <span>5xx Error: {systemMetrics?.errorRate5xx ?? 0.02}%</span>
          </div>
        </div>

        {/* Metric 4: Cloud Run Nodes */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800/80 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400">Cloud Run Containers</span>
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <Server className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-100">
            {systemMetrics?.cloudRunInstanceCount ?? 4} <span className="text-xs text-slate-500 font-normal">instances</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
            <span className="text-sky-400 font-semibold">Uptime: {systemMetrics?.uptimePercentage ?? 99.98}%</span>
            <span>Auto-scaled</span>
          </div>
        </div>
      </div>

      {/* Main Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 1: System RPS Throughput & Latency Trend */}
        <div className="lg:col-span-2 p-6 rounded-3xl bg-slate-900 border border-slate-800/80 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-400" />
                <span>System Throughput (RPS) & Response Latency</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Live 30-minute rolling request frequency and response speed</p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 font-mono text-[10px] font-semibold border border-emerald-500/20">
              LIVE TELEMETRY
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={telemetryData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="rpsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="latGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="time" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "12px", fontSize: "12px" }}
                />
                <Area type="monotone" dataKey="rps" name="Requests / Sec" stroke="#6366f1" fillOpacity={1} fill="url(#rpsGrad)" strokeWidth={2} />
                <Area type="monotone" dataKey="latencyMs" name="Latency (ms)" stroke="#10b981" fillOpacity={1} fill="url(#latGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Side Panel: Active Incident Summary & SLA Compliance */}
        <div className="space-y-6">
          {/* Active Incidents Widget */}
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800/80 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>Incident Center</span>
              </h3>
              <button
                onClick={() => onNavigate("/admin/monitoring")}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
              >
                View All <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {activeIncidents.length === 0 ? (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <span className="font-bold block">All Systems Operational</span>
                  <span className="text-[11px] text-emerald-400/80">No active incidents or service degradation detected.</span>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {activeIncidents.map((incident) => (
                  <div
                    key={incident.incidentId}
                    className="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-200">{incident.title}</span>
                      <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-mono text-[10px] font-bold">
                        {incident.severity}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-1">{incident.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SLA Tracking Gauge */}
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800/80 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">SLA Availability Target</span>
              <span className="text-xs font-mono font-bold text-emerald-400">99.98%</span>
            </div>
            <div className="w-full h-3 rounded-full bg-slate-950 border border-slate-800 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 w-[99.98%] rounded-full"></div>
            </div>
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>SLA Target: 99.90%</span>
              <span>Downtime this month: 4m 12s</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
