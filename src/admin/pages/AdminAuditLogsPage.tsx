/**
 * Enterprise Platform Administration - Audit Logs Page
 * Domain: Platform Administration (Isolated from Shop Dashboard)
 */

import React, { useEffect, useState } from "react";
import {
  FileSpreadsheet,
  Search,
  Download,
  Eye,
  ShieldCheck,
  X,
  FileCode,
  Calendar,
  Filter
} from "lucide-react";
import { useAdminStore } from "../store/adminStore";
import { IAuditLogEntryUI } from "../types/adminTypes";

export const AdminAuditLogsPage: React.FC = () => {
  const fetchAuditLogs = useAdminStore((state) => state.fetchAuditLogs);
  const auditLogs = useAdminStore((state) => state.auditLogs);
  const auditLogsTotal = useAdminStore((state) => state.auditLogsTotal);
  const exportAuditLogs = useAdminStore((state) => state.exportAuditLogs);

  const [selectedLog, setSelectedLog] = useState<IAuditLogEntryUI | null>(null);
  const [filterAction, setFilterAction] = useState<string>("ALL");
  const [searchActor, setSearchActor] = useState<string>("");

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const filteredLogs = auditLogs.filter((log) => {
    if (filterAction !== "ALL" && log.action !== filterAction) return false;
    if (searchActor && !log.actorEmail.toLowerCase().includes(searchActor.toLowerCase())) return false;
    return true;
  });

  const handleExportCSV = async () => {
    const csvContent = await exportAuditLogs("csv");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `audit-trail-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 font-mono text-xs font-semibold uppercase tracking-wider mb-1">
            <FileSpreadsheet className="w-4 h-4" />
            <span>Immutable Cryptographic Audit Ledger</span>
          </div>
          <h1 className="text-2xl font-black text-slate-100">Security Audit Trail</h1>
          <p className="text-xs text-slate-400 mt-1">
            Immutable log of all administrative actions, configuration updates, and security events.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors flex items-center gap-2 border border-slate-700 cursor-pointer shrink-0"
        >
          <Download className="w-4 h-4 text-indigo-400" />
          <span>Export Audit Trail (CSV)</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3 rtl:right-3 rtl:left-auto" />
            <input
              type="text"
              value={searchActor}
              onChange={(e) => setSearchActor(e.target.value)}
              placeholder="Search by actor email or correlation ID..."
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="ALL">All Event Types</option>
            <option value="TENANT_STATUS_UPDATED">TENANT_STATUS_UPDATED</option>
            <option value="TENANT_PLAN_MIGRATED">TENANT_PLAN_MIGRATED</option>
            <option value="PLATFORM_CONFIG_UPDATED">PLATFORM_CONFIG_UPDATED</option>
            <option value="MFA_VERIFIED">MFA_VERIFIED</option>
          </select>
        </div>

        <span className="font-mono text-slate-400">Total Entries: {filteredLogs.length}</span>
      </div>

      {/* Table */}
      <div className="bg-slate-900 rounded-3xl border border-slate-800/80 shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300 border-collapse">
            <thead className="bg-slate-950/80 text-slate-400 font-bold border-b border-slate-800/80 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="p-4">Timestamp</th>
                <th className="p-4">Event Type</th>
                <th className="p-4">Actor Email</th>
                <th className="p-4">Target Resource</th>
                <th className="p-4">Correlation ID</th>
                <th className="p-4 text-right rtl:text-left">Inspection</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredLogs.map((log) => (
                <tr key={log.auditId} className="hover:bg-slate-800/40 transition-colors">
                  <td className="p-4 font-mono text-[11px] text-slate-400">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="p-4">
                    <span className="px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-300 font-mono font-bold text-[10px] uppercase border border-indigo-500/20">
                      {log.action}
                    </span>
                  </td>
                  <td className="p-4 font-medium text-slate-100">{log.actorEmail}</td>
                  <td className="p-4 font-mono text-slate-400">{log.targetResourceId || "-"}</td>
                  <td className="p-4 font-mono text-[11px] text-slate-500">{log.ipAddress}</td>
                  <td className="p-4 text-right rtl:text-left">
                    <button
                      onClick={() => setSelectedLog(log)}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer flex items-center gap-1 ml-auto rtl:mr-auto"
                    >
                      <Eye className="w-3.5 h-3.5 text-indigo-400" />
                      <span>JSON Payload</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* JSON Inspection Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 text-slate-100">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <FileCode className="w-4 h-4 text-indigo-400" />
                <span>Audit Log Raw JSON Event</span>
              </h3>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <pre className="p-4 rounded-2xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-indigo-300 overflow-x-auto max-h-96">
              {JSON.stringify(selectedLog, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
