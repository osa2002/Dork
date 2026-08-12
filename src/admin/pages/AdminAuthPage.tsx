/**
 * Enterprise Platform Administration - Authentication Screen
 * Domain: Platform Administration (Isolated from Shop Dashboard)
 */

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ShieldCheck,
  KeyRound,
  Lock,
  Sparkles,
  UserCheck,
  ArrowRight,
  AlertCircle,
  Home
} from "lucide-react";
import { useAdminStore } from "../store/adminStore";
import { AdminRoleType } from "../types/adminTypes";

interface IAdminAuthPageProps {
  onSuccess: () => void;
  onBackToHome?: () => void;
}

export const AdminAuthPage: React.FC<IAdminAuthPageProps> = ({ onSuccess, onBackToHome }) => {
  const { t, i18n } = useTranslation();
  const setAdminUser = useAdminStore((state) => state.setAdminUser);
  const setMfaVerified = useAdminStore((state) => state.setMfaVerified);

  const [email, setEmail] = useState("admin@dork.platform");
  const [password, setPassword] = useState("••••••••••••");
  const [mfaCode, setMfaCode] = useState("123456");
  const [selectedRole, setSelectedRole] = useState<AdminRoleType>("SUPER_ADMIN");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const isRtl = i18n.language?.startsWith("ar");

  const rolesList: Array<{ role: AdminRoleType; label: string; desc: string }> = [
    { role: "SUPER_ADMIN", label: t("admin_role_super_admin", "Super Admin"), desc: t("admin_role_super_admin_desc", "Full root authority across tenants, security, and infrastructure.") },
    { role: "PLATFORM_OPERATOR", label: t("admin_role_operator", "Platform Operator"), desc: t("admin_role_operator_desc", "Manages Cloud Run telemetry, incidents, and maintenance.") },
    { role: "SUPPORT_ENGINEER", label: t("admin_role_support", "Support Engineer"), desc: t("admin_role_support_desc", "Tenant status management and diagnostic inspection.") },
    { role: "COMPLIANCE_OFFICER", label: t("admin_role_compliance", "Compliance Officer"), desc: t("admin_role_compliance_desc", "Audit trail inspection, export, and security oversight.") },
    { role: "FINANCE_AUDITOR", label: t("admin_role_finance", "Finance Auditor"), desc: t("admin_role_finance_desc", "Quota usage and tenant tier migration auditing.") }
  ];

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError(t("admin_auth_err_creds", "Please provide admin email and security credential."));
      return;
    }

    if (mfaCode.length < 6) {
      setError(t("admin_mfa_6digits_err", "MFA security token must be 6 digits."));
      return;
    }

    setIsLoading(true);
    setError(null);

    setTimeout(() => {
      const adminIdentity = {
        adminId: `adm_${selectedRole.toLowerCase()}_${Date.now().toString().slice(-4)}`,
        email,
        displayName: `${selectedRole.replace("_", " ")} Officer`,
        role: selectedRole,
        permissions: [
          "tenant:read",
          "tenant:suspend",
          "tenant:migrate_tier",
          "tenant:delete",
          "metrics:read_system",
          "metrics:read_business",
          "config:read",
          "config:write",
          "config:emergency_shutdown",
          "audit:read",
          "audit:export",
          "security:read",
          "security:revoke_sessions",
          "security:manage_roles",
          "security:manage_keys",
          "incident:read",
          "incident:manage",
          "maintenance:manage"
        ] as any[],
        mfaActive: true,
        sessionExpiresAt: new Date(Date.now() + 8 * 3600 * 1000).toISOString()
      };

      setAdminUser(adminIdentity);
      setMfaVerified(true);
      setIsLoading(false);
      onSuccess();
    }, 800);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 font-sans" dir={isRtl ? "rtl" : "ltr"}>
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        {/* Background Ambient Glow */}
        <div className="absolute -top-24 -left-24 rtl:-right-24 rtl:-left-auto w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -right-24 rtl:-left-24 rtl:-right-auto w-48 h-48 bg-violet-500/10 rounded-full blur-3xl pointer-events-none"></div>

        {/* Header Branding */}
        <div className="text-center mb-8 relative z-10">
          <div className="flex justify-between items-center mb-4">
            <button
              onClick={() => {
                if (onBackToHome) {
                  onBackToHome();
                } else {
                  window.history.pushState({}, "", "/");
                  window.dispatchEvent(new Event("popstate"));
                }
              }}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer border border-slate-700/60"
            >
              <Home className="w-3.5 h-3.5" />
              <span>{isRtl ? "الرئيسية" : "Home"}</span>
            </button>
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-xl shadow-indigo-500/30">
              <Sparkles className="w-6 h-6" />
            </div>
            <div className="w-16"></div>
          </div>
          <h1 className="text-2xl font-black text-slate-100 tracking-tight">{t("admin_control_plane", "Dork Control Plane")}</h1>
          <p className="text-xs text-slate-400 mt-1 font-medium">{t("admin_console_desc", "Enterprise Platform Administration Console")}</p>
        </div>

        {error && (
          <div className="p-3 mb-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4 relative z-10">
          {/* Admin Email */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">{t("admin_email_label", "Admin Email Address")}</label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 rtl:pr-10 rtl:pl-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
                required
              />
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 rtl:right-3 rtl:left-auto top-3" />
            </div>
          </div>

          {/* Admin Password */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">{t("admin_cred_label", "Security Credential")}</label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 rtl:pr-10 rtl:pl-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
                required
              />
              <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 rtl:right-3 rtl:left-auto top-3" />
            </div>
          </div>

          {/* MFA TOTP Code */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">{t("admin_auth_code", "MFA Security Code (TOTP)")}</label>
            <input
              type="text"
              maxLength={6}
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs font-mono tracking-widest text-center focus:outline-none focus:border-indigo-500"
              required
            />
          </div>

          {/* Role Preset Selector (for demo and audit context) */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
              <span>{t("admin_role_context", "Admin Role Context")}</span>
              <span className="text-[10px] text-indigo-400 font-mono">{t("admin_rbac_testing", "RBAC Testing")}</span>
            </label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as AdminRoleType)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              {rolesList.map((r) => (
                <option key={r.role} value={r.role}>
                  {r.label} - ({r.role})
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500 mt-1 italic">
              {rolesList.find((r) => r.role === selectedRole)?.desc}
            </p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-4 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <span>{t("admin_validating_identity", "Validating Encrypted Identity...")}</span>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>{t("admin_authenticate_submit", "Authenticate to Admin Console")}</span>
                <ArrowRight className="w-4 h-4 ml-auto rtl:mr-auto rtl:ml-0 rtl:rotate-180 shrink-0" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-800 text-center text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
          <UserCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>{t("admin_isolated_realm", "Cloud Run Sandboxed Isolated Admin Realm")}</span>
        </div>
      </div>
    </div>
  );
};

