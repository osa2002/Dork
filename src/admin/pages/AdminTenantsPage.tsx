/**
 * Enterprise Platform Administration - Tenant Directory Page
 * Domain: Platform Administration (Isolated from Shop Dashboard)
 */

import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-indigo-50/90 via-slate-50 to-indigo-50/90 dark:from-slate-900 dark:via-indigo-950/40 dark:to-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-xl transition-colors duration-200">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-mono text-xs font-semibold uppercase tracking-wider mb-1">
            <Building2 className="w-4 h-4" />
            <span>{t("admin_tenant_directory_title", "Tenant Directory")}</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100">{t("admin_tenant_directory_title", "Tenant Directory")}</h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            {t("admin_tenant_directory_desc", "Manage tenant shop statuses, subscription tier migrations, and quota overrides across Cloud Run pods.")}
          </p>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 shadow-sm transition-colors duration-200">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-3 rtl:right-3 rtl:left-auto" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("admin_search_tenants_placeholder", "Search by shop name, owner email, ID...")}
              className="w-full pl-9 pr-4 rtl:pr-9 rtl:pl-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          {/* Status Filter Dropdown */}
          <select
            value={activeFilterStatus || "ALL"}
            onChange={(e) => setActiveFilterStatus(e.target.value === "ALL" ? null : e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="ALL">{t("admin_all_statuses", "All Statuses")}</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="SUSPENDED">SUSPENDED</option>
            <option value="PROVISIONING">PROVISIONING</option>
          </select>

          {/* Plan Tier Filter Dropdown */}
          <select
            value={selectedPlanFilter}
            onChange={(e) => setSelectedPlanFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="ALL">{t("admin_all_tiers", "All Tiers")}</option>
            <option value="free">Free Tier</option>
            <option value="pro">Pro Tier</option>
            <option value="enterprise">Enterprise Tier</option>
          </select>
        </div>

        <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
          {t("admin_showing", "Showing")} <span className="font-bold text-slate-900 dark:text-slate-100" dir="ltr">{filteredTenants.length}</span> {t("admin_of", "of")} <span dir="ltr">{tenantTotal || filteredTenants.length}</span>
        </div>
      </div>

      {/* Tenants Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800/80 shadow-sm dark:shadow-2xl overflow-hidden transition-colors duration-200">
        <div className="overflow-x-auto">
          <table className="w-full text-left rtl:text-right text-xs text-slate-700 dark:text-slate-300 border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-950/80 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800/80 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="p-4">{t("admin_tenant_shop", "Tenant / Shop")}</th>
                <th className="p-4">{t("admin_plan_tier", "Plan Tier")}</th>
                <th className="p-4">{t("admin_status", "Status")}</th>
                <th className="p-4">{t("admin_daily_tickets", "Daily Tickets")}</th>
                <th className="p-4">{t("admin_active_queue", "Active Queue")}</th>
                <th className="p-4">{t("admin_quota_capacity", "Quota Capacity")}</th>
                <th className="p-4 text-right rtl:text-left">{t("admin_actions", "Actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
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
                filteredTenants.map((tItem) => (
                  <tr key={tItem.shopId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-slate-900 dark:text-slate-100">{tItem.businessName}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono" dir="ltr">{tItem.shopId} &bull; {tItem.ownerEmail}</div>
                    </td>
                    <td className="p-4">
                      <span className="px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-mono font-bold text-[10px] uppercase border border-indigo-500/20">
                        {tItem.planType}
                      </span>
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase border ${
                          tItem.status === "ACTIVE"
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                            : "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20"
                        }`}
                      >
                        {tItem.status}
                      </span>
                    </td>
                    <td className="p-4 font-mono font-bold text-slate-800 dark:text-slate-200" dir="ltr">{tItem.dailyTicketCount}</td>
                    <td className="p-4 font-mono text-indigo-600 dark:text-indigo-400 font-bold" dir="ltr">{tItem.activeQueueLength}</td>
                    <td className="p-4">
                      <div className="w-24 bg-slate-100 dark:bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-200 dark:border-slate-800 mb-1">
                        <div
                          className="bg-indigo-500 h-full rounded-full"
                          style={{ width: `${Math.min(tItem.quotaUsagePercent, 100)}%` }}
                        ></div>
                      </div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono" dir="ltr">{tItem.quotaUsagePercent}%</span>
                    </td>
                    <td className="p-4 text-right rtl:text-left">
                      <button
                        onClick={() => setSelectedTenant(tItem)}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-medium text-xs transition-colors flex items-center gap-1.5 ml-auto rtl:mr-auto rtl:ml-0 cursor-pointer border border-slate-200 dark:border-slate-700"
                      >
                        <Eye className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                        <span>{t("admin_inspect", "Inspect")}</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>{t("admin_page", "Page")} <span className="font-mono font-bold text-slate-800 dark:text-slate-200" dir="ltr">{tenantPage}</span></span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchTenants(Math.max(tenantPage - 1, 1))}
              disabled={tenantPage <= 1}
              className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 disabled:opacity-40 text-slate-800 dark:text-slate-300 font-semibold cursor-pointer border border-slate-300 dark:border-slate-700"
            >
              {t("admin_previous", "Previous")}
            </button>
            <button
              onClick={() => fetchTenants(tenantPage + 1)}
              className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-300 font-semibold cursor-pointer border border-slate-300 dark:border-slate-700"
            >
              {t("admin_next", "Next")}
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
