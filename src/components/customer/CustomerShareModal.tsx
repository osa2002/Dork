import React from "react";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import { XCircle, Share2, Check, Copy } from "lucide-react";
import { Shop, Ticket } from "../../types";

interface CustomerShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  myTicket: Ticket;
  shop: Shop;
  getDirectTicketUrl: () => string;
  handleCopyLink: () => void;
  copied: boolean;
  isRtl: boolean;
}

export function CustomerShareModal({
  isOpen,
  onClose,
  myTicket,
  shop,
  getDirectTicketUrl,
  handleCopyLink,
  copied,
  isRtl
}: CustomerShareModalProps) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  const directUrl = getDirectTicketUrl();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
      />
      
      {/* Modal Content */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", duration: 0.35 }}
        className="relative w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-2xl z-10 text-center space-y-4"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 end-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 p-1.5 rounded-full transition-all cursor-pointer"
        >
          <XCircle className="w-4 h-4" />
        </button>

        <div className="flex flex-col items-center">
          <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-950/40 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-3">
            <Share2 className="w-6 h-6" />
          </div>

          <h3 className="text-base font-black text-slate-900 dark:text-white">
            {isRtl ? "مشاركة تذكرتك" : "Share Your Ticket"}
          </h3>
          
          <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold leading-relaxed mt-1.5 max-w-[280px]">
            {isRtl 
              ? "شارك رابط تذكرتك المباشر لمتابعة حالة دورك في الطابور بسهولة وفي أي وقت"
              : "Share your direct ticket link to track your queue status easily anytime"}
          </p>
        </div>

        {/* Copy Link Container */}
        <div className="bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-850 rounded-2xl p-3 flex items-center justify-between gap-2.5">
          <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold truncate dir-ltr select-all flex-1 text-start">
            {directUrl}
          </span>
          
          <button
            type="button"
            onClick={handleCopyLink}
            className="shrink-0 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 p-2 rounded-xl transition-all border border-slate-200 dark:border-slate-700 active:scale-95 cursor-pointer flex items-center justify-center"
            title={isRtl ? "نسخ الرابط" : "Copy Link"}
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            )}
          </button>
        </div>

        {/* Popular Social Destinations */}
        <div className="grid grid-cols-1 gap-2 pt-1">
          {/* WhatsApp */}
          <a
            href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
              (isRtl 
                ? `تابع حالة دوري الرقمي #${myTicket.ticketNumber} مباشرة في طابور الانتظار لدى ${shop.name}:` 
                : `Track my digital ticket #${myTicket.ticketNumber} live at ${shop.name}:`) + "\n" + directUrl
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs py-3 rounded-2xl transition-all shadow-sm active:scale-98 cursor-pointer"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current shrink-0">
              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.713-1.457L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.42 9.864-9.864.002-2.637-1.03-5.114-2.905-6.99C16.546 1.88 14.078.845 11.442.844c-5.441 0-9.865 4.422-9.87 9.865-.001 1.802.495 3.56 1.438 5.114L1.93 21.567l5.881-1.542zm11.365-5.393c-.313-.156-1.85-.913-2.128-1.015-.279-.1-.482-.15-.683.15-.202.3-.777.979-.953 1.18-.176.2-.352.226-.665.07-1.298-.65-2.118-1.12-2.952-2.558-.231-.4-.084-.617.073-.773.14-.14.313-.365.469-.548.156-.182.209-.313.313-.522.105-.209.052-.391-.026-.547-.078-.156-.683-1.644-.936-2.251-.247-.593-.498-.513-.683-.522-.176-.008-.377-.01-.578-.01-.202 0-.53.075-.808.377-.279.301-1.063 1.041-1.063 2.537 0 1.497 1.088 2.943 1.24 3.144.151.202 2.141 3.27 5.19 4.584.724.312 1.29.499 1.731.639.728.231 1.39.198 1.912.12.583-.087 1.85-.756 2.11-1.448.261-.692.261-1.285.183-1.411-.078-.125-.285-.201-.599-.356z"/>
            </svg>
            <span>{isRtl ? "مشاركة عبر واتساب" : "Share via WhatsApp"}</span>
          </a>

          {/* Telegram */}
          <a
            href={`https://t.me/share/url?url=${encodeURIComponent(directUrl)}&text=${encodeURIComponent(
              isRtl 
                ? `تابع حالة دوري الرقمي #${myTicket.ticketNumber} مباشرة في طابور الانتظار لدى ${shop.name}:` 
                : `Track my digital ticket #${myTicket.ticketNumber} live at ${shop.name}:`
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 bg-sky-500 hover:bg-sky-600 text-white font-black text-xs py-3 rounded-2xl transition-all shadow-sm active:scale-98 cursor-pointer"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current shrink-0">
              <path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0zm5.56 8.18l-1.92 9.04c-.14.65-.53.8-.1.54l-2.93-2.16-1.41 1.36c-.16.16-.29.29-.6.29l.21-2.98 5.42-4.9c.24-.21-.05-.33-.37-.12l-6.7 4.22-2.89-.9c-.63-.2-.64-.63.13-.93l11.29-4.35c.52-.19.98.12.78.91z"/>
            </svg>
            <span>{isRtl ? "مشاركة عبر تلغرام" : "Share via Telegram"}</span>
          </a>

          {/* Twitter / X */}
          <a
            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
              (isRtl 
                ? `تابع حالة دوري الرقمي #${myTicket.ticketNumber} لدى ${shop.name}:` 
                : `Track my digital ticket #${myTicket.ticketNumber} at ${shop.name}:`) + "\n" + directUrl
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-950 dark:bg-slate-850 dark:hover:bg-slate-800 text-white font-black text-xs py-3 rounded-2xl transition-all shadow-sm active:scale-98 cursor-pointer"
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current shrink-0">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            <span>{isRtl ? "مشاركة عبر تويتر / X" : "Share via Twitter / X"}</span>
          </a>
        </div>
      </motion.div>
    </div>
  );
}
