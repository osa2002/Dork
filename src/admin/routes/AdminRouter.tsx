/**
 * Enterprise Platform Administration - Router & Lazy Load Component
 * Domain: Platform Administration (Isolated from Shop Dashboard)
 */

import React, { Suspense, lazy } from "react";
import { useAdminStore } from "../store/adminStore";
import { AdminLayout } from "../layouts/AdminLayout";
import { AdminAuthPage } from "../pages/AdminAuthPage";
import { RBACGuard } from "../components/RBACGuard";
import { FeatureFlagGuard } from "../components/FeatureFlagGuard";

const AdminDashboardPage = lazy(() =>
  import("../pages/AdminDashboardPage").then((m) => ({ default: m.AdminDashboardPage }))
);
const AdminTenantsPage = lazy(() =>
  import("../pages/AdminTenantsPage").then((m) => ({ default: m.AdminTenantsPage }))
);
const AdminMonitoringPage = lazy(() =>
  import("../pages/AdminMonitoringPage").then((m) => ({ default: m.AdminMonitoringPage }))
);
const AdminSecurityPage = lazy(() =>
  import("../pages/AdminSecurityPage").then((m) => ({ default: m.AdminSecurityPage }))
);
const AdminConfigPage = lazy(() =>
  import("../pages/AdminConfigPage").then((m) => ({ default: m.AdminConfigPage }))
);
const AdminAuditLogsPage = lazy(() =>
  import("../pages/AdminAuditLogsPage").then((m) => ({ default: m.AdminAuditLogsPage }))
);

export const AdminRouter: React.FC = () => {
  const user = useAdminStore((state) => state.user);
  const isAuthenticated = useAdminStore((state) => state.isAuthenticated);
  const activePath = useAdminStore((state) => state.activePath);
  const setActivePath = useAdminStore((state) => state.setActivePath);
  const logout = useAdminStore((state) => state.logout);

  if (!isAuthenticated || !user) {
    return <AdminAuthPage onSuccess={() => setActivePath("/admin")} />;
  }

  const renderActivePage = () => {
    switch (activePath) {
      case "/admin":
      case "/admin/dashboard":
        return (
          <RBACGuard permission="metrics:read_system">
            <AdminDashboardPage onNavigate={setActivePath} />
          </RBACGuard>
        );

      case "/admin/tenants":
        return (
          <RBACGuard permission="tenant:read">
            <AdminTenantsPage />
          </RBACGuard>
        );

      case "/admin/monitoring":
        return (
          <RBACGuard permission="metrics:read_system">
            <AdminMonitoringPage />
          </RBACGuard>
        );

      case "/admin/security":
        return (
          <RBACGuard permission="security:read">
            <AdminSecurityPage />
          </RBACGuard>
        );

      case "/admin/config":
        return (
          <RBACGuard permission="config:read">
            <AdminConfigPage />
          </RBACGuard>
        );

      case "/admin/audit-logs":
        return (
          <RBACGuard permission="audit:read">
            <AdminAuditLogsPage />
          </RBACGuard>
        );

      default:
        return (
          <RBACGuard permission="metrics:read_system">
            <AdminDashboardPage onNavigate={setActivePath} />
          </RBACGuard>
        );
    }
  };

  return (
    <AdminLayout onNavigate={setActivePath} onLogout={logout}>
      <Suspense
        fallback={
          <div className="flex flex-col items-center justify-center p-12 text-slate-400 space-y-3">
            <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"></div>
            <p className="text-xs font-mono">Loading Admin Module Chunk...</p>
          </div>
        }
      >
        {renderActivePage()}
      </Suspense>
    </AdminLayout>
  );
};
