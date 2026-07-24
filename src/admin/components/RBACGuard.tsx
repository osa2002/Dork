/**
 * Enterprise Platform Administration - RBAC Guard Component
 * Domain: Platform Administration (Isolated from Shop Dashboard)
 */

import React, { ReactNode } from "react";
import { AdminPermissionType } from "../types/adminTypes";
import { useAdminStore } from "../store/adminStore";
import { ShieldAlert } from "lucide-react";

export interface IRBACGuardProps {
  permission: AdminPermissionType;
  fallback?: ReactNode;
  children: ReactNode;
}

export const RBACGuard: React.FC<IRBACGuardProps> = ({ permission, fallback, children }) => {
  const hasPermission = useAdminStore((state) => state.hasPermission(permission));

  if (!hasPermission) {
    if (fallback) return <>{fallback}</>;
    return (
      <div className="p-6 rounded-2xl border border-rose-500/20 bg-rose-500/5 text-rose-300 flex items-center gap-3 my-4">
        <ShieldAlert className="w-6 h-6 text-rose-400 shrink-0" />
        <div>
          <h4 className="font-semibold text-sm text-rose-200">Access Restricted</h4>
          <p className="text-xs text-rose-300/80 mt-0.5">
            Your current role does not grant permission <code className="px-1.5 py-0.5 bg-rose-950/60 rounded text-rose-200 font-mono text-[11px]">{permission}</code>.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
