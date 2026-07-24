/**
 * Enterprise Platform Administration - Breadcrumb
 * Domain: Platform Administration (Isolated from Shop Dashboard)
 */

import React from "react";
import { ChevronRight, ShieldCheck } from "lucide-react";
import { ADMIN_ROUTES } from "../routes/adminRoutes.config";

interface IBreadcrumbProps {
  currentPath: string;
}

export const Breadcrumb: React.FC<IBreadcrumbProps> = ({ currentPath }) => {
  // Determine matching route label
  const matchedKey = Object.keys(ADMIN_ROUTES).find((key) => {
    const route = ADMIN_ROUTES[key];
    if (route.isExact) return route.path === currentPath;
    return currentPath.startsWith(route.path);
  });

  const matchedRoute = matchedKey ? ADMIN_ROUTES[matchedKey] : null;

  return (
    <nav aria-label="Breadcrumb" className="flex items-center text-xs text-slate-400 gap-2 py-1 select-none">
      <div className="flex items-center gap-1.5 text-indigo-400 font-semibold">
        <ShieldCheck className="w-3.5 h-3.5" />
        <span>Dork Enterprise Admin</span>
      </div>

      <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0 rtl:rotate-180" />

      {matchedRoute ? (
        <span className="text-slate-200 font-medium">{matchedRoute.breadcrumbLabel}</span>
      ) : (
        <span className="text-slate-200 font-medium">Console</span>
      )}
    </nav>
  );
};
