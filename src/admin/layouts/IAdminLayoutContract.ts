/**
 * Enterprise Platform Administration - Layout Contracts
 * Domain: Platform Administration (Isolated from Shop Dashboard)
 */

import { ReactNode } from "react";
import { IAdminUserProfile, IAdminNavigationItem } from "../types/adminTypes";

export interface IAdminLayoutProps {
  children: ReactNode;
}

export interface IAdminSidebarProps {
  navItems: IAdminNavigationItem[];
  activePath: string;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onNavigate: (path: string) => void;
}

export interface IAdminTopBarProps {
  user: IAdminUserProfile | null;
  mfaVerified: boolean;
  onLogout: () => void;
  onOpenNotifications: () => void;
}

export interface IAdminBreadcrumbProps {
  currentPath: string;
}

export interface IAdminSecurityBannerProps {
  mfaVerified: boolean;
  sessionTimeRemainingSeconds: number;
}
