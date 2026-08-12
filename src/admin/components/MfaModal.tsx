/**
 * Enterprise Platform Administration - Step-Up MFA Verification Modal
 * Domain: Platform Administration (Isolated from Shop Dashboard)
 */

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { KeyRound, CheckCircle2, ShieldCheck, X, AlertCircle } from "lucide-react";
import { useAdminStore } from "../store/adminStore";

export const MfaModal: React.FC = () => {
  const { t } = useTranslation();
  const mfaPromptOpen = useAdminStore((state) => state.mfaPromptOpen);
  const setMfaPromptOpen = useAdminStore((state) => state.setMfaPromptOpen);
  const setMfaVerified = useAdminStore((state) => state.setMfaVerified);

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!mfaPromptOpen) return null;

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim().length < 6) {
      setError(t("admin_mfa_6digits_err", "MFA security token must be 6 digits."));
      return;
    }

    setError(null);
    setSuccess(true);
    setTimeout(() => {
      setMfaVerified(true);
      setMfaPromptOpen(false);
      setSuccess(false);
      setCode("");
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative text-slate-900 dark:text-slate-100">
        <button
          onClick={() => setMfaPromptOpen(false)}
          className="absolute top-4 right-4 rtl:left-4 rtl:right-auto p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">{t("admin_step_up_title", "Step-Up MFA Verification")}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t("admin_step_up_subtitle", "Required for elevated administrative operations")}</p>
          </div>
        </div>

        {error && (
          <div className="p-3 mb-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success ? (
          <div className="p-6 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-center flex flex-col items-center gap-2 my-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400 animate-bounce" />
            <h4 className="font-bold text-sm text-emerald-900 dark:text-emerald-200">{t("admin_step_up_success", "Step-Up Authorization Verified")}</h4>
            <p className="text-xs text-emerald-700 dark:text-emerald-400/80">{t("admin_step_up_success_desc", "Privileged admin permissions granted for current session.")}</p>
          </div>
        ) : (
          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t("admin_auth_code", "Authenticator Security Code (TOTP)")}
              </label>
              <input
                type="text"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 font-mono text-center text-xl tracking-widest focus:outline-none focus:border-indigo-500"
                autoFocus
              />
              <p className="text-[11px] text-slate-500 mt-1.5">
                {t("admin_auth_demo_hint", "Enter code from Google Authenticator, YubiKey, or Duo. (Demo code: 123456)")}
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setMfaPromptOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
              >
                {t("admin_cancel", "Cancel")}
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors cursor-pointer shadow-lg shadow-indigo-600/20 flex items-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{t("admin_verify_submit", "Verify Authorization")}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

