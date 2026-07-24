import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Camera, CameraOff, Loader2, AlertCircle, Sparkles, ExternalLink } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import { useTranslation } from "react-i18next";
import { collection, query, where, getDocs, limit } from "firebase/firestore";
import { db } from "../../lib/firebase";

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (slug: string) => void;
}

export default function QrScannerModal({ isOpen, onClose, onScanSuccess }: QrScannerModalProps) {
  const { t, i18n } = useTranslation();
  const isRtl = (i18n.language || "ar").startsWith("ar");

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isInsideIframe, setIsInsideIframe] = useState(false);
  const [manualSlug, setManualSlug] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsInsideIframe(window.self !== window.top);
    }
  }, []);
  const [manualError, setManualError] = useState<string | null>(null);
  const [isCheckingManual, setIsCheckingManual] = useState(false);
  const [activeScanner, setActiveScanner] = useState<Html5Qrcode | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const startPromiseRef = useRef<Promise<any> | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Reset camera activation status when modal opens or closes
  useEffect(() => {
    if (!isOpen) {
      setIsCameraActive(false);
    }
  }, [isOpen]);

  // Parse scanned text and trigger success if valid slug is found
  const handleScanSuccess = async (decodedText: string) => {
    const slug = extractShopSlug(decodedText);
    if (slug) {
      // Vibrate on success
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(200);
      }
      onScanSuccess(slug);
    } else {
      setScannerError(t("qr_scanner_invalid_code", { defaultValue: isRtl ? "رمز QR غير صالح للمحلات" : "Invalid shop QR code" }));
    }
  };

  const extractShopSlug = (text: string): string | null => {
    const cleanText = text.trim();
    if (!cleanText) return null;

    try {
      if (cleanText.startsWith("http://") || cleanText.startsWith("https://")) {
        const url = new URL(cleanText);
        const portalMatch = url.pathname.match(/\/portal\/([^/?#]+)/);
        if (portalMatch && portalMatch[1]) {
          return decodeURIComponent(portalMatch[1]);
        }
        const shopParam = url.searchParams.get("shop");
        if (shopParam) {
          return decodeURIComponent(shopParam);
        }
      }
    } catch (e) {
      console.warn("Not a valid URL, trying regex:", e);
    }

    const portalRegex = /\/portal\/([^/?#]+)/;
    const match = cleanText.match(portalRegex);
    if (match && match[1]) {
      try {
        return decodeURIComponent(match[1]);
      } catch {
        return match[1];
      }
    }

    const slugRegex = /^[a-zA-Z0-9-_%]+$/;
    if (slugRegex.test(cleanText)) {
      try {
        return decodeURIComponent(cleanText);
      } catch {
        return cleanText;
      }
    }

    return null;
  };

  // Handle manual code submission
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualSlug.trim()) return;

    setManualError(null);
    setIsCheckingManual(true);

    try {
      const cleanSlug = manualSlug.trim();
      const shopsRef = collection(db, "shops");
      const q = query(shopsRef, where("slug", "==", cleanSlug), limit(1));
      const snap = await getDocs(q);

      if (snap.empty) {
        setManualError(t("qr_scanner_invalid_code", { defaultValue: isRtl ? "رمز المحل غير صحيح أو غير موجود" : "Invalid or non-existent shop code" }));
      } else {
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          navigator.vibrate(100);
        }
        onScanSuccess(cleanSlug);
      }
    } catch (err) {
      console.error("Error verifying manual slug:", err);
      setManualError(t("error_occurred", { defaultValue: isRtl ? "حدث خطأ أثناء التحقق من الكود" : "An error occurred while verifying the code" }));
    } finally {
      setIsCheckingManual(false);
    }
  };

  // Forcibly stop any camera tracks that might have been leaked by the browser or library
  const stopAllCameraTracks = () => {
    try {
      const container = document.getElementById("qr-reader-container");
      if (container) {
        const videos = container.querySelectorAll("video");
        videos.forEach((video) => {
          const stream = video.srcObject as MediaStream | null;
          if (stream && typeof stream.getTracks === "function") {
            stream.getTracks().forEach((track) => {
              try {
                track.stop();
              } catch (err) {
                console.error("Error stopping track:", err);
              }
            });
            video.srcObject = null;
          }
        });
      }
    } catch (e) {
      console.error("Error forcibly stopping camera tracks:", e);
    }
  };

  const cleanupScanner = async () => {
    // 1. Clear any pending initialization timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const scanner = scannerRef.current;
    if (scanner) {
      try {
        // 2. If start is in progress, wait for it to complete first to avoid stopping a starting scanner
        if (startPromiseRef.current) {
          try {
            await startPromiseRef.current;
          } catch (err) {
            console.warn("Start promise was rejected during cleanup:", err);
          }
          startPromiseRef.current = null;
        }

        // 3. Stop if currently scanning
        if (scanner.isScanning) {
          await scanner.stop();
        }

        // 4. Clear the UI container
        scanner.clear();
      } catch (err) {
        console.error("Error during scanner stop/clear:", err);
      } finally {
        scannerRef.current = null;
        setActiveScanner(null);
      }
    }

    // 5. Hard fail-safe: Force stop all camera tracks in any video element inside the container
    stopAllCameraTracks();
  };

  useEffect(() => {
    if (!isOpen || !isCameraActive) {
      cleanupScanner();
      return;
    }

    let isMounted = true;
    setIsInitializing(true);
    setScannerError(null);

    timerRef.current = setTimeout(() => {
      if (!isMounted) return;

      try {
        const container = document.getElementById("qr-reader-container");
        if (!container) return;

        // Ensure any previous scanner is completely cleaned up first
        cleanupScanner().then(() => {
          if (!isMounted) return;

          // Check if userMedia is supported in this browser context (like non-HTTPS or nested iframe)
          if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            setScannerError(
              t("qr_scanner_error_unsupported", {
                defaultValue: isRtl 
                  ? "المتصفح أو الإطار الحالي لا يدعم الوصول إلى الكاميرا. يرجى التأكد من تشغيل التطبيق عبر اتصال آمن (HTTPS) أو فتحه في علامة تبويب جديدة." 
                  : "The browser or current frame does not support camera access. Please ensure you are using HTTPS or open the app in a new tab."
              })
            );
            setIsInitializing(false);
            return;
          }

          const html5QrCode = new Html5Qrcode("qr-reader-container");
          scannerRef.current = html5QrCode;
          setActiveScanner(html5QrCode);

          const startPromise = html5QrCode.start(
            { facingMode: "environment" },
            {
              fps: 10,
              qrbox: (width, height) => {
                const size = Math.min(width, height) * 0.7;
                return { width: size, height: size };
              }
            },
            (decodedText) => {
              if (isMounted) {
                handleScanSuccess(decodedText);
              }
            },
            () => {
              // Silence verbose debug frame scan failures
            }
          );

          startPromiseRef.current = startPromise;

          startPromise
            .then(() => {
              if (isMounted) {
                setIsInitializing(false);
              }
            })
            .catch((err) => {
              const errorStr = String(err);
              const isPermissionError = errorStr.includes("NotAllowedError") || errorStr.includes("Permission denied") || errorStr.includes("NotReadableError");
              
              if (isPermissionError) {
                console.warn("Camera start permission denied:", err);
              } else {
                console.error("Camera start error:", err);
              }

              if (isMounted) {
                let errorMsg = t("qr_scanner_error_permission", {
                  defaultValue: isRtl 
                    ? "لم نتمكن من تشغيل الكاميرا. يرجى تفعيل إذن الكاميرا من إعدادات المتصفح وإعادة المحاولة." 
                    : "Unable to access camera. Please allow camera permission in your browser settings and try again."
                });

                if (isPermissionError) {
                  errorMsg = t("qr_scanner_error_permission_denied", {
                    defaultValue: isRtl
                      ? "تم رفض إذن الكاميرا. يرجى الضغط على أيقونة القفل أو الكاميرا بجانب شريط العنوان للسماح بالوصول."
                      : "Camera permission was denied. Please click the lock or camera icon in your address bar to allow access."
                  });
                }

                setScannerError(errorMsg);
                setIsInitializing(false);
              }
            });
        });
      } catch (err) {
        const errorStr = String(err);
        if (errorStr.includes("NotAllowedError") || errorStr.includes("Permission denied") || errorStr.includes("NotReadableError")) {
          console.warn("Html5Qrcode init permission denied:", err);
        } else {
          console.error("Html5Qrcode init error:", err);
        }
        if (isMounted) {
          setScannerError(
            t("qr_scanner_error_permission", {
              defaultValue: isRtl 
                ? "حدث خطأ أثناء تشغيل قارئ الرموز." 
                : "An error occurred while initializing the QR scanner."
            })
          );
          setIsInitializing(false);
        }
      }
    }, 400);

    return () => {
      isMounted = false;
      cleanupScanner();
    };
  }, [isOpen, isCameraActive]);


  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
        />

        {/* Modal Box */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative z-10 flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-5 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  {t("qr_scanner_title", { defaultValue: isRtl ? "قارئ الرموز المدمج" : "Integrated QR Scanner" })}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-0.5">
                  {t("qr_scanner_subtitle", { defaultValue: isRtl ? "امسح رمز QR الخاص بالمحل للانضمام فوراً" : "Scan the shop QR code to join instantly" })}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scanner Viewport */}
          <div className="p-6 flex-1 overflow-y-auto space-y-6">
            <div className="relative aspect-square w-full max-w-[280px] mx-auto bg-slate-950 rounded-2xl overflow-hidden shadow-inner border border-slate-800">
              {isCameraActive ? (
                <>
                  <div id="qr-reader-container" className="w-full h-full" />

                  {/* Loader */}
                  {isInitializing && (
                    <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center text-center p-4">
                      <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-2" />
                      <span className="text-xs text-slate-400 font-bold">
                        {t("qr_scanner_initializing", { defaultValue: isRtl ? "جاري تشغيل الكاميرا..." : "Starting camera..." })}
                      </span>
                    </div>
                  )}

                  {/* Viewfinder Target & Laser Overlay */}
                  {!isInitializing && !scannerError && (
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      <div className="relative w-48 h-48 border-2 border-dashed border-indigo-500/60 rounded-xl flex items-center justify-center overflow-hidden">
                        {/* Corners */}
                        <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-indigo-400" />
                        <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-indigo-400" />
                        <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-indigo-400" />
                        <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-indigo-400" />
                        {/* Glowing Laser */}
                        <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-indigo-500 to-transparent shadow-[0_0_8px_rgba(99,102,241,0.8)] laser-line" />
                      </div>
                    </div>
                  )}

                  {/* Error overlay / Permission Denied */}
                  {scannerError && (
                    <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center text-center p-6 text-slate-200 overflow-y-auto">
                      <CameraOff className="w-8 h-8 text-rose-500 mb-2 flex-shrink-0" />
                      <p className="text-xs leading-relaxed font-semibold max-w-[220px] mb-3">
                        {scannerError}
                      </p>
                      <div className="flex flex-col gap-2 w-full max-w-[220px]">
                        <button
                          type="button"
                          onClick={() => {
                            setScannerError(null);
                            setIsCameraActive(false);
                          }}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-indigo-500/20 w-full"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span>{t("qr_scanner_try_again", { defaultValue: isRtl ? "إعادة المحاولة" : "Try Again" })}</span>
                        </button>

                        {isInsideIframe && (
                          <a
                            href={window.location.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-extrabold text-xs px-4 py-2.5 rounded-xl transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer border border-slate-700/80 w-full"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>{t("qr_scanner_open_new_tab", { defaultValue: isRtl ? "الفتح في نافذة جديدة" : "Open in New Tab" })}</span>
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* Camera Activation Placeholder UI */
                <div className="absolute inset-0 bg-slate-900/95 dark:bg-slate-950 flex flex-col items-center justify-center text-center p-6">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-4 animate-pulse">
                    <Camera className="w-7 h-7" />
                  </div>
                  <h4 className="text-sm font-black text-white mb-1.5">
                    {t("camera_activation_title", { defaultValue: isRtl ? "مطلوب إذن الكاميرا" : "Camera Permission Required" })}
                  </h4>
                  <p className="text-[11px] text-slate-450 dark:text-slate-400 leading-relaxed font-semibold mb-5 max-w-[220px]">
                    {t("camera_activation_desc", { 
                      defaultValue: isRtl 
                        ? "الرجاء السماح للتطبيق بتشغيل الكاميرا لقراءة رمز الاستجابة السريعة (QR) الخاص بالمحل." 
                        : "Please allow the app to run the camera to read the shop's QR code." 
                    })}
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsCameraActive(true)}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs px-5 py-3 rounded-xl transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-md shadow-indigo-500/20"
                  >
                    <Camera className="w-4 h-4" />
                    <span>{t("camera_activation_btn", { defaultValue: isRtl ? "تشغيل الكاميرا" : "Enable Camera" })}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Custom injected styling for the HTML5-QRCODE canvas elements */}
            <style dangerouslySetInnerHTML={{ __html: `
              @keyframes scanLaser {
                0% { top: 10%; }
                50% { top: 90%; }
                100% { top: 10%; }
              }
              .laser-line {
                position: absolute;
                animation: scanLaser 2.2s infinite ease-in-out;
              }
              #qr-reader-container video {
                width: 100% !important;
                height: 100% !important;
                object-fit: cover !important;
                border-radius: 1rem;
              }
              #qr-reader-container__scan_region {
                background: transparent !important;
              }
              #qr-reader-container {
                border: none !important;
              }
            `}} />

            {/* Manual Fallback Form */}
            <div className="border-t border-slate-100 dark:border-slate-800/80 pt-6">
              <form onSubmit={handleManualSubmit} className="space-y-3">
                <label className="block text-xs font-black text-slate-600 dark:text-slate-400">
                  {t("qr_scanner_manual_fallback", { defaultValue: isRtl ? "أو أدخل كود المحل يدوياً:" : "Or enter shop code manually:" })}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualSlug}
                    onChange={(e) => {
                      setManualSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-_%]/g, ""));
                      setManualError(null);
                    }}
                    placeholder={t("qr_scanner_manual_placeholder", { defaultValue: isRtl ? "مثال: barber-salon" : "e.g., barber-salon" })}
                    className="flex-1 min-w-0 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                  <button
                    type="submit"
                    disabled={isCheckingManual || !manualSlug.trim()}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-all active:scale-95 flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    {isCheckingManual ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Camera className="w-4 h-4" />
                        <span>{t("qr_scanner_join_btn", { defaultValue: isRtl ? "انضمام" : "Join" })}</span>
                      </>
                    )}
                  </button>
                </div>
                {manualError && (
                  <div className="flex items-center gap-1.5 text-xs text-rose-500 font-bold bg-rose-50 dark:bg-rose-950/20 p-2.5 rounded-xl border border-rose-100 dark:border-rose-950/50">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{manualError}</span>
                  </div>
                )}
              </form>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
