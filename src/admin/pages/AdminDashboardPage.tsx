/**
 * Enterprise Platform Administration - Operations & Health Dashboard Page
 * Domain: Platform Administration (Isolated from Shop Dashboard)
 */

import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  const isDarkMode = useAdminStore((state) => state.isDarkMode);
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

  const activeIncidents = incidents.filter((i) => i.status !== "RESOLVED");

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-indigo-50/90 via-slate-50 to-indigo-50/90 dark:from-slate-900 dark:via-indigo-950/40 dark:to-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-2xl relative overflow-hidden transition-colors duration-200">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-mono text-xs font-semibold uppercase tracking-wider mb-1">
            <Zap className="w-4 h-4" />
            <span>{t("admin_telemetry_live", "Platform Telemetry Engine • Live")}</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100">{t("admin_global_ops_overview", "Global Operations & Health Overview")}</h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-xl">
            {t("admin_telemetry_desc", "Real-time monitoring for tenant queues, Cloud Run instances, system throughput, and SLA compliance.")}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => {
              fetchSystemMetrics();
              fetchDiagnostics();
            }}
            className="px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold transition-colors flex items-center gap-2 cursor-pointer border border-slate-200 dark:border-slate-700 shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>{t("admin_refresh_diag", "Refresh Diagnostics")}</span>
          </button>
        </div>
      </div>

      {/* Primary Telemetry Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Active Tenants */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-sm dark:shadow-lg relative overflow-hidden transition-colors duration-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t("admin_active_tenants", "Active Tenants")}</span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-slate-100 font-mono" dir="ltr">
            {systemMetrics?.activeTenantsCount ?? 142}
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> <span dir="ltr">+12%</span>
            </span>
            <span>{t("admin_capacity", "Capacity")} <span dir="ltr" className="font-mono">500</span></span>
          </div>
        </div>

        {/* Metric 2: Queued Customers */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-sm dark:shadow-lg relative overflow-hidden transition-colors duration-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t("admin_queued_tickets", "Active Queued Tickets")}</span>
            <div className="p-2 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-slate-100 font-mono" dir="ltr">
            {systemMetrics?.totalQueuedCustomers ?? 89}
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span className="text-violet-600 dark:text-violet-400 font-semibold">{t("admin_across_all_shops", "Across all shops")}</span>
            <span>{t("admin_realtime_sync", "Real-time Sync")}</span>
          </div>
        </div>

        {/* Metric 3: System Throughput */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-sm dark:shadow-lg relative overflow-hidden transition-colors duration-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t("admin_throughput_rps", "Throughput (RPS)")}</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-slate-100 font-mono" dir="ltr">
            {systemMetrics?.systemThroughputRps ?? 245.8} <span className="text-xs text-slate-500 font-normal">req/s</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{t("admin_p95_latency", "P95 Latency")}: <span dir="ltr" className="font-mono">{systemMetrics?.latencyP95Ms ?? 42}ms</span></span>
            <span>{t("admin_5xx_error", "5xx Error")}: <span dir="ltr" className="font-mono">{systemMetrics?.errorRate5xx ?? 0.02}%</span></span>
          </div>
        </div>

        {/* Metric 4: Cloud Run Nodes */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-sm dark:shadow-lg relative overflow-hidden transition-colors duration-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t("admin_cloud_containers", "Cloud Run Containers")}</span>
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
              <Server className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-slate-100 font-mono" dir="ltr">
            {systemMetrics?.cloudRunInstanceCount ?? 4} <span className="text-xs text-slate-500 font-normal">instances</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span className="text-sky-600 dark:text-sky-400 font-semibold">{t("admin_uptime", "Uptime")}: <span dir="ltr" className="font-mono">{systemMetrics?.uptimePercentage ?? 99.98}%</span></span>
            <span>{t("admin_autoscaled", "Auto-scaled")}</span>
          </div>
        </div>
      </div>

      {/* Main Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 1: System RPS Throughput & Latency Trend */}
        <div className="lg:col-span-2 p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-sm dark:shadow-xl space-y-4 transition-colors duration-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>{t("admin_throughput_chart_title", "System Throughput (RPS) & Response Latency")}</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t("admin_throughput_chart_subtitle", "Live 30-minute rolling request frequency and response speed")}</p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-[10px] font-semibold border border-emerald-500/20">
              {t("admin_live_telemetry_badge", "LIVE TELEMETRY")}
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
                <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? "#1e293b" : "#e2e8f0"} />
                <XAxis dataKey="time" stroke={isDarkMode ? "#64748b" : "#94a3b8"} fontSize={11} />
                <YAxis stroke={isDarkMode ? "#64748b" : "#94a3b8"} fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDarkMode ? "#0f172a" : "#ffffff",
                    borderColor: isDarkMode ? "#334155" : "#cbd5e1",
                    color: isDarkMode ? "#f8fafc" : "#0f172a",
                    borderRadius: "12px",
                    fontSize: "12px"
                  }}
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
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-sm dark:shadow-xl space-y-4 transition-colors duration-200">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                <span>{t("admin_incident_center", "Incident Center")}</span>
              </h3>
              <button
                onClick={() => onNavigate("/admin/monitoring")}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 font-semibold flex items-center gap-1 cursor-pointer"
              >
                {t("admin_view_all", "View All")} <ArrowUpRight className="w-3.5 h-3.5 rtl:rotate-180" />
              </button>
            </div>

            {activeIncidents.length === 0 ? (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <span className="font-bold block">{t("admin_all_systems_operational", "All Systems Operational")}</span>
                  <span className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80">{t("admin_no_active_incidents", "No active incidents or service degradation detected.")}</span>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {activeIncidents.map((incident) => (
                  <div
                    key={incident.incidentId}
                    className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 dark:text-slate-200">{incident.title}</span>
                      <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-600 dark:text-rose-300 font-mono text-[10px] font-bold">
                        {incident.severity}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">{incident.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SLA Tracking Gauge */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-sm dark:shadow-xl space-y-3 transition-colors duration-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{t("admin_sla_availability", "SLA Availability Target")}</span>
              <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400" dir="ltr">99.98%</span>
            </div>
            <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 w-[99.98%] rounded-full"></div>
            </div>
            <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400">
              <span>{t("admin_sla_target", "SLA Target")}: <span dir="ltr" className="font-mono">99.90%</span></span>
              <span>{t("admin_downtime_month", "Downtime this month")}: <span dir="ltr" className="font-mono">4m 12s</span></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
