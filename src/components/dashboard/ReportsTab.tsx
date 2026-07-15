import React from "react";
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  AreaChart, Area, CartesianGrid, Legend 
} from "recharts";
import { 
  TrendingUp, Download, Loader2, Award, Zap, BrainCircuit, AlertCircle, HelpCircle, FileSpreadsheet, Star
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Ticket } from "../../types";

interface ReportsTabProps {
  reportStartDate: string;
  setReportStartDate: (val: string) => void;
  reportEndDate: string;
  setReportEndDate: (val: string) => void;
  exportLoading: boolean;
  reportError: string | null;
  filteredReportTickets: Ticket[];
  totalReportCount: number;
  completedReportCount: number;
  cancelledReportCount: number;
  noShowReportCount: number;
  averageReportWaitMinutes: number;
  averageReportServiceMinutes: number;
  satisfactionScore: number;
  speedScore: number;
  qualityScore: number;
  staffLeaderboard: Array<{ name: string; completed: number; avgRating: number }>;
  dailyTrends: Array<{ date: string; completed: number; cancelled: number; waiting: number }>;
  serviceDistribution: Array<{ name: string; value: number }>;
  handleExportCSV: () => void;
  aiAnalysis: string;
  aiLoading: boolean;
  aiError: string | null;
  handleAskAiDiagnostics: () => void;
  isRtl: boolean;
}

export function ReportsTab({
  reportStartDate,
  setReportStartDate,
  reportEndDate,
  setReportEndDate,
  exportLoading,
  reportError,
  filteredReportTickets,
  totalReportCount,
  completedReportCount,
  cancelledReportCount,
  noShowReportCount,
  averageReportWaitMinutes,
  averageReportServiceMinutes,
  satisfactionScore,
  speedScore,
  qualityScore,
  staffLeaderboard,
  dailyTrends,
  serviceDistribution,
  handleExportCSV,
  aiAnalysis,
  aiLoading,
  aiError,
  handleAskAiDiagnostics,
  isRtl
}: ReportsTabProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6 animate-fade-in animate-duration-200" id="reports-tab">
      {/* Date Filter & Export Header Row */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 rounded-3xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="space-y-0.5">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
              {t("report_start_date_label", "Report Start Date")}
            </label>
            <input 
              type="date"
              value={reportStartDate}
              onChange={(e) => setReportStartDate(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-white"
            />
          </div>

          <div className="hidden sm:block text-slate-300 mt-4">|</div>

          <div className="space-y-0.5">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
              {t("report_end_date_label", "Report End Date")}
            </label>
            <input 
              type="date"
              value={reportEndDate}
              onChange={(e) => setReportEndDate(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-white"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {reportError && (
            <span className="text-[10px] text-rose-500 font-bold max-w-xs truncate mr-2">
              ⚠️ {reportError}
            </span>
          )}

          <button
            onClick={handleExportCSV}
            disabled={exportLoading}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black text-xs px-5 py-3 rounded-2xl cursor-pointer transition-all flex items-center justify-center gap-2 shadow"
            id="btn-export-csv"
          >
            {exportLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <FileSpreadsheet className="w-4 h-4" />
                <span>{t("vend_export_csv_btn", "Export Records CSV")}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Numerical Analytics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: t("stat_total_customers", "Total Customers"), value: totalReportCount, sub: t("stats_within_range", "Within date range"), color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/30 dark:text-indigo-400" },
          { title: t("stat_completed_visits", "Completed Visits"), value: completedReportCount, sub: t("stats_successful_services", "Successfully served"), color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400" },
          { title: t("stat_cancelled_visits", "Cancelled & Lost"), value: cancelledReportCount, sub: t("stats_unserved_customers", "Customers skipped"), color: "text-rose-600 bg-rose-50 dark:bg-rose-950/30 dark:text-rose-400" },
          { title: t("stat_satisfaction_score", "Satisfaction Star"), value: satisfactionScore > 0 ? `${satisfactionScore}/5.0` : "—", sub: t("stats_avg_feedback", "Avg client ratings"), color: "text-amber-500 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400" }
        ].map((stat, idx) => (
          <div key={idx} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 rounded-3xl shadow-sm space-y-2">
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-wider block truncate">{stat.title}</span>
            <div className="flex items-baseline gap-2">
              <span className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white font-mono">{stat.value}</span>
            </div>
            <span className="text-[9px] text-slate-400 font-medium block truncate">{stat.sub}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* Left Side: Daily trends Area graph */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 rounded-3xl shadow-sm flex flex-col justify-between space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-indigo-600" />
            <h4 className="text-sm font-black text-slate-900 dark:text-white">
              {t("vend_daily_load_trends", "Daily Load Trends")}
            </h4>
          </div>

          <div className="h-[260px] w-full text-xs font-bold">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorCancelled" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" className="dark:hidden" />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: "#0f172a", borderRadius: "12px", border: "none", color: "#fff", fontSize: "11px" }}
                  itemStyle={{ color: "#fff" }}
                />
                <Legend iconType="circle" />
                <Area type="monotone" name={t("stats_completed_label", "Completed")} dataKey="completed" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorCompleted)" />
                <Area type="monotone" name={t("stats_cancelled_label", "Cancelled")} dataKey="cancelled" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorCancelled)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right Side: Service durations & speeds metrics */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 rounded-3xl shadow-sm flex flex-col justify-between space-y-4">
          <h4 className="text-sm font-black text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2">
            {t("vend_avg_wait_times_title", "Waiting & Serving Efficiencies")}
          </h4>

          <div className="space-y-4 py-2">
            <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-850 p-3 rounded-2xl border border-slate-100 dark:border-slate-800/60">
              <div className="space-y-0.5">
                <span className="text-[10px] text-slate-400 block font-black uppercase tracking-wider">{t("stat_avg_waiting_title", "Avg Customer Waiting")}</span>
                <span className="text-xs text-slate-500 font-medium leading-relaxed">{t("avg_time_to_call", "Time until cashier call")}</span>
              </div>
              <span className="text-lg font-black font-mono text-indigo-600 dark:text-indigo-400 shrink-0">
                {averageReportWaitMinutes} {t("time_mins_abbrev", "mins")}
              </span>
            </div>

            <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-850 p-3 rounded-2xl border border-slate-100 dark:border-slate-800/60">
              <div className="space-y-0.5">
                <span className="text-[10px] text-slate-400 block font-black uppercase tracking-wider">{t("stat_avg_service_title", "Avg Client Serving")}</span>
                <span className="text-xs text-slate-500 font-medium leading-relaxed">{t("avg_time_at_window", "Time spent at window")}</span>
              </div>
              <span className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400 shrink-0">
                {averageReportServiceMinutes} {t("time_mins_abbrev", "mins")}
              </span>
            </div>
          </div>

          <p className="text-[10px] text-slate-400 leading-relaxed text-center">
            {t("efficiency_optimization_alert", "Optimized target limits: keep average waiting below 15 mins to maximize customer ratings.")}
          </p>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* Left Side: Employees & Counter performance Leaderboard */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 rounded-3xl shadow-sm flex flex-col justify-between space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
            <Award className="w-4 h-4 text-indigo-600" />
            <h4 className="text-sm font-black text-slate-900 dark:text-white">
              {t("vend_counter_performance_leaderboard", "Counter Operations & Leaderboard")}
            </h4>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto max-h-[220px] pr-1">
            {staffLeaderboard.length > 0 ? (
              staffLeaderboard.map((staff, index) => {
                let prizeIcon = "👤";
                if (index === 0) prizeIcon = "👑";
                else if (index === 1) prizeIcon = "⭐";

                return (
                  <div key={index} className="flex items-center justify-between gap-3 text-xs py-2 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2.5">
                      <span className="text-base">{prizeIcon}</span>
                      <div className="space-y-0.5">
                        <p className="font-black text-slate-800 dark:text-slate-200">{staff.name}</p>
                        <p className="text-[10px] text-slate-400 font-medium">Rank #{index + 1} • Active Operations</p>
                      </div>
                    </div>

                    <div className="text-right space-y-0.5">
                      <p className="font-extrabold text-slate-900 dark:text-white">
                        {staff.completed} {t("stats_served_abbrev", "served")}
                      </p>
                      <span className="text-[10px] text-amber-500 font-black">
                        ★ {staff.avgRating} / 5.0
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-10 text-slate-400 dark:text-slate-500 text-xs">
                {t("vend_leaderboard_empty_msg", "No completed ticket data recorded to generate leaderboard.")}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Gemini Advisor AI Smart diagnostics box */}
        <div className="lg:col-span-6 bg-slate-900 text-slate-200 p-5 sm:p-6 rounded-3xl shadow-xl border border-slate-800 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-indigo-400">
              <BrainCircuit className="w-5 h-5" />
              <h4 className="text-sm font-black text-white">
                {t("ai_diagnostics_title", "Gemini Queue Advisor & Diagnostics")}
              </h4>
            </div>

            <button
              onClick={handleAskAiDiagnostics}
              disabled={aiLoading}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black text-[10px] py-1.5 px-3.5 rounded-xl cursor-pointer transition-all flex items-center gap-1 shadow-md shadow-indigo-950"
              id="btn-ask-ai-diagnostics"
            >
              {aiLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <>
                  <Zap className="w-3 h-3 fill-white" />
                  <span>{t("ai_advisor_analyze_btn", "Generate Advice")}</span>
                </>
              )}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[160px] text-xs leading-relaxed space-y-2 text-slate-300 scrollbar-thin scrollbar-thumb-slate-800 pr-1">
            {aiLoading ? (
              <div className="flex flex-col items-center justify-center py-6 text-center text-slate-400 gap-2">
                <BrainCircuit className="w-8 h-8 text-indigo-400 animate-pulse" />
                <p className="font-extrabold animate-bounce text-[11px]">
                  {t("ai_advisor_loading_pulse", "Analyzing ticket loads and waiting peaks, please wait...")}
                </p>
              </div>
            ) : aiError ? (
              <div className="flex gap-2 p-3 bg-rose-950/20 border border-rose-900/40 rounded-xl text-rose-400 text-[11px]">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>{aiError}</p>
              </div>
            ) : aiAnalysis ? (
              <div className="whitespace-pre-line font-medium text-slate-300 leading-relaxed font-sans select-text">
                {aiAnalysis}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-4 text-center text-slate-500 gap-2">
                <BrainCircuit className="w-7 h-7 text-slate-700" />
                <p className="text-[11px] font-semibold max-w-xs leading-normal">
                  {t("ai_advisor_ready_instructions", "Need advice? Click the generate button. Gemini will inspect average waiting bottlenecks and staff performances to draft actionable improvements.")}
                </p>
              </div>
            )}
          </div>

          <div className="border-t border-slate-800/80 pt-3 flex items-center justify-between text-[9px] text-slate-400">
            <span>Powered by Gemini API</span>
            <span className="flex items-center gap-1">
              <Star className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />
              <span>Diagnostic advice is advisor grade</span>
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
