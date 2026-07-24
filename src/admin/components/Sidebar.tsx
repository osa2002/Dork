/**
 * Enterprise Platform Administration - Sidebar Navigation Component
 * Domain: Platform Administration (Isolated from Shop Dashboard)
 */

import React from "react";
import {
  LayoutDashboard,
  Building2,
  Activity,
  ShieldCheck,
  Sliders,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  AlertTriangle,
  X
} from "lucide-react";
import { useAdminStore } from "../store/adminStore";
import { ADMIN_ROUTES } from "../routes/adminRoutes.config";

interface ISidebarProps {
  onNavigate: (path: string) => void;
}

export const Sidebar: React.FC<ISidebarProps> = ({ onNavigate }) => {
  const activePath = useAdminStore((state) => state.activePath);
  const sidebarCollapsed = useAdminStore((state) => state.sidebarCollapsed);
  const setSidebarCollapsed = useAdminStore((state) => state.setSidebarCollapsed);
  const mobileDrawerOpen = useAdminStore((state) => state.mobileDrawerOpen);
  const setMobileDrawerOpen = useAdminStore((state) => state.setMobileDrawerOpen);
  const hasPermission = useAdminStore((state) => state.hasPermission);

  const incidents = useAdminStore((state) => state.incidents);
  const alerts = useAdminStore((state) => state.alerts);

  const openIncidentsCount = incidents.filter((i) => i.status !== "RESOLVED").length;
  const criticalAlertsCount = alerts.filter((a) => a.severity === "CRITICAL" && a.status === "ACTIVE").length;

  const navGroups = [
    {
      groupLabel: "Core Operations",
      items: [
        {
          key: "DASHBOARD",
          label: ADMIN_ROUTES.DASHBOARD.name,
          path: ADMIN_ROUTES.DASHBOARD.path,
          icon: LayoutDashboard,
          permission: ADMIN_ROUTES.DASHBOARD.requiredPermission
        },
        {
          key: "TENANTS",
          label: ADMIN_ROUTES.TENANTS.name,
          path: ADMIN_ROUTES.TENANTS.path,
          icon: Building2,
          permission: ADMIN_ROUTES.TENANTS.requiredPermission
        }
      ]
    },
    {
      groupLabel: "Observability & Control",
      items: [
        {
          key: "MONITORING",
          label: "Monitoring & Incidents",
          path: "/admin/monitoring",
          icon: Activity,
          permission: "metrics:read_system" as const,
          badgeCount: openIncidentsCount
        },
        {
          key: "SECURITY",
          label: "Security & Governance",
          path: "/admin/security",
          icon: ShieldCheck,
          permission: "security:read" as const,
          badgeCount: criticalAlertsCount
        }
      ]
    },
    {
      groupLabel: "Platform Management",
      items: [
        {
          key: "PLATFORM_CONFIG",
          label: ADMIN_ROUTES.PLATFORM_CONFIG.name,
          path: ADMIN_ROUTES.PLATFORM_CONFIG.path,
          icon: Sliders,
          permission: ADMIN_ROUTES.PLATFORM_CONFIG.requiredPermission
        },
        {
          key: "AUDIT_LOGS",
          label: ADMIN_ROUTES.AUDIT_LOGS.name,
          path: ADMIN_ROUTES.AUDIT_LOGS.path,
          icon: FileSpreadsheet,
          permission: ADMIN_ROUTES.AUDIT_LOGS.requiredPermission
        }
      ]
    }
  ];

  const handleItemClick = (path: string) => {
    onNavigate(path);
    setMobileDrawerOpen(false);
  };

  const navContent = (
    <div className="flex flex-col h-full bg-slate-950 text-slate-300 border-r border-slate-800/80 transition-all duration-300 select-none">
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          {!sidebarCollapsed && (
            <div className="flex flex-col">
              <span className="font-bold text-sm text-slate-100 tracking-wide">Dork Admin</span>
              <span className="text-[10px] text-indigo-400 font-medium">Enterprise Control Plane</span>
            </div>
          )}
        </div>

        {/* Desktop Collapse Toggle Button */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="hidden lg:flex p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {sidebarCollapsed ? <ChevronRight className="w-4 h-4 rtl:rotate-180" /> : <ChevronLeft className="w-4 h-4 rtl:rotate-180" />}
        </button>

        {/* Mobile Close Button */}
        <button
          onClick={() => setMobileDrawerOpen(false)}
          className="lg:hidden p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto p-3 space-y-6 scrollbar-thin scrollbar-thumb-slate-800">
        {navGroups.map((group, idx) => (
          <div key={idx} className="space-y-1">
            {!sidebarCollapsed && (
              <h4 className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                {group.groupLabel}
              </h4>
            )}

            {group.items.map((item) => {
              if (item.permission && !hasPermission(item.permission)) {
                return null;
              }

              const isSelected = activePath === item.path || (item.path !== "/admin" && activePath.startsWith(item.path));
              const Icon = item.icon;

              return (
                <button
                  key={item.key}
                  onClick={() => handleItemClick(item.path)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    isSelected
                      ? "bg-indigo-600/15 text-indigo-300 border border-indigo-500/30 shadow-md shadow-indigo-950/40"
                      : "text-slate-400 hover:bg-slate-900 hover:text-slate-200 border border-transparent"
                  }`}
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isSelected ? "text-indigo-400" : "text-slate-400"}`} />
                  {!sidebarCollapsed && <span className="truncate flex-1 text-left rtl:text-right">{item.label}</span>}
                  
                  {item.badgeCount && item.badgeCount > 0 ? (
                    <span className="px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-mono text-[10px] border border-rose-500/30 font-bold shrink-0">
                      {item.badgeCount}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer Info */}
      {!sidebarCollapsed && (
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/60 text-[11px] text-slate-500 flex items-center justify-between">
          <span>Version v2.8.0-enterprise</span>
          <span className="flex items-center gap-1 text-emerald-400 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            Cloud Run
          </span>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className={`hidden lg:block h-screen sticky top-0 transition-all duration-300 ${sidebarCollapsed ? "w-20" : "w-64"}`}>
        {navContent}
      </aside>

      {/* Mobile Drawer Backdrop & Drawer */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileDrawerOpen(false)}
          ></div>
          <div className="relative w-72 max-w-full bg-slate-950 h-full shadow-2xl z-10">
            {navContent}
          </div>
        </div>
      )}
    </>
  );
};
