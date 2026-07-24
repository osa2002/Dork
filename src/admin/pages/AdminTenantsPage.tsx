/**
 * Enterprise Platform Administration - Tenant Directory Page
 * Domain: Platform Administration (Isolated from Shop Dashboard)
 */

import React, { useEffect, useState } from "react";
import {
  Building2,
  Search,
  Filter,
  Eye,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers
} from "lucide-react";
import { useAdminStore } from "../store/adminStore";
import { ITenantSummaryUI } from "../types/adminTypes";
import { TenantInspectorModal } from "../components/TenantInspectorModal";

export const AdminTenantsPage: React.FC = () => {
  const fetchTenants = useAdminStore((state) => state.fetchTenants);
  const tenants = useAdminStore((state) => state.tenants);
  const tenantTotal = useAdminStore((state) => state.tenantTotal);
  const tenantPage = useAdminStore((state) => state.tenantPage);
  const isLoading = useAdminStore((state) => state.isLoading);
  const searchQuery = useAdminStore((state) => state.searchQuery);
  const setSearchQuery = useAdminStore((state) => state.setSearchQuery);
  const activeFilterStatus = useAdminStore((state) => state.activeFilterStatus);
  const setActiveFilterStatus = useAdminStore((state) => state.setActiveFilterStatus);

  const updateTenantStatus = useAdminStore((state) => state.updateTenantStatus);
  const updateTenantPlan = useAdminStore((state) => state.updateTenantPlan);
  const softDeleteTenant = useAdminStore((state) => state.softDeleteTenant);

  const [selectedTenant, setSelectedTenant] = useState<ITenantSummaryUI | null>(null);
  const [selectedPlanFilter, setSelectedPlanFilter] = useState<string>("ALL");

  useEffect(() => {
    fetchTenants(1, 20);
  }, [searchQuery, activeFilterStatus]);

  const filteredTenants = tenants.filter((t) => {
    if (selectedPlanFilter !== "ALL" && t.planType !== selectedPlanFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 font-mono text-xs font-semibold uppercase tracking-wider mb-1">
            <Building2 className="w-4 h-4" />
            <span>Multi-Tenant Provisioning Directory</span>
          </div>
          <h1 className="text-2xl font-black text-slate-100">Tenant Directory</h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage tenant shop statuses, subscription tier migrations, and quota overrides across Cloud Run pods.
          </p>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3 rtl:right-3 rtl:left-auto" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by shop name, owner email, ID..."
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Status Filter Dropdown */}
          <select
            value={activeFilterStatus || "ALL"}
            onChange={(e) => setActiveFilterStatus(e.target.value === "ALL" ? null : e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="SUSPENDED">SUSPENDED</option>
            <option value="PROVISIONING">PROVISIONING</option>
          </select>

          {/* Plan Tier Filter Dropdown */}
          <select
            value={selectedPlanFilter}
            onChange={(e) => setSelectedPlanFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="ALL">All Tiers</option>
            <option value="free">Free Tier</option>
            <option value="pro">Pro Tier</option>
            <option value="enterprise">Enterprise Tier</option>
          </select>
        </div>

        <div className="text-xs font-mono text-slate-400">
          Showing <span className="font-bold text-slate-100">{filteredTenants.length}</span> of {tenantTotal || filteredTenants.length}
        </div>
      </div>

      {/* Tenants Table */}
      <div className="bg-slate-900 rounded-3xl border border-slate-800/80 shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300 border-collapse">
            <thead className="bg-slate-950/80 text-slate-400 font-bold border-b border-slate-800/80 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="p-4">Tenant / Shop</th>
                <th className="p-4">Plan Tier</th>
                <th className="p-4">Status</th>
                <th className="p-4">Daily Tickets</th>
                <th className="p-4">Active Queue</th>
                <th className="p-4">Quota Capacity</th>
                <th className="p-4 text-right rtl:text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    Loading tenant directory from Firestore...
                  </td>
                </tr>
              ) : filteredTenants.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    No tenants match the specified search or filter criteria.
                  </td>
                </tr>
              ) : (
                filteredTenants.map((t) => (
                  <tr key={t.shopId} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-slate-100">{t.businessName}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{t.shopId} &bull; {t.ownerEmail}</div>
                    </td>
                    <td className="p-4">
                      <span className="px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-300 font-mono font-bold text-[10px] uppercase border border-indigo-500/20">
                        {t.planType}
                      </span>
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase border ${
                          t.status === "ACTIVE"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td className="p-4 font-mono font-bold text-slate-200">{t.dailyTicketCount}</td>
                    <td className="p-4 font-mono text-indigo-400 font-bold">{t.activeQueueLength}</td>
                    <td className="p-4">
                      <div className="w-24 bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800 mb-1">
                        <div
                          className="bg-indigo-500 h-full rounded-full"
                          style={{ width: `${Math.min(t.quotaUsagePercent, 100)}%` }}
                        ></div>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">{t.quotaUsagePercent}%</span>
                    </td>
                    <td className="p-4 text-right rtl:text-left">
                      <button
                        onClick={() => setSelectedTenant(t)}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs transition-colors flex items-center gap-1.5 ml-auto rtl:mr-auto cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400">
          <span>Page {tenantPage}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchTenants(Math.max(tenantPage - 1, 1))}
              disabled={tenantPage <= 1}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 font-semibold cursor-pointer"
            >
              Previous
            </button>
            <button
              onClick={() => fetchTenants(tenantPage + 1)}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Tenant Inspector Modal */}
      <TenantInspectorModal
        tenant={selectedTenant}
        onClose={() => setSelectedTenant(null)}
        onStatusChange={updateTenantStatus}
        onPlanChange={updateTenantPlan}
        onSoftDelete={softDeleteTenant}
      />
    </div>
  );
};
