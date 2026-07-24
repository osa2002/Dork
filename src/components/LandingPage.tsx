import React, { useState, lazy, Suspense } from "react";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { 
  QrCode, 
  Clock, 
  Bell, 
  Store, 
  CheckCircle2, 
  ChevronDown, 
  Users, 
  Sparkles,
  ArrowRight,
  Sun,
  Moon,
  X,
  Smartphone,
  Printer,
  HelpCircle,
  Download,
  Loader2
} from "lucide-react";
import { PlanItem, FAQItem } from "../types";
import LanguageSwitcher from "./LanguageSwitcher";

const QrScannerModal = lazy(() => import("./customer/QrScannerModal"));

const QrScannerFallback = ({ isOpen, onClose, isRtl, t }: { isOpen: boolean; onClose: () => void; isRtl: boolean; t: any }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity duration-200"
      />

      {/* Modal Box */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative z-10 flex flex-col max-h-[90vh] p-8 items-center justify-center text-center">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">
          {t("loading", { defaultValue: isRtl ? "جاري تحميل قارئ الرموز..." : "Loading QR Scanner..." })}
        </h3>
      </div>
    </div>
  );
};

interface LandingPageProps {
  onStart: () => void;
  onGoToDashboard: () => void;
  userLoggedIn: boolean;
  isDarkMode: boolean;
  setIsDarkMode: (val: boolean) => void;
  onJoinShop: (slug: string) => void;
}

export default function LandingPage({ onStart, onGoToDashboard, userLoggedIn, isDarkMode, setIsDarkMode, onJoinShop }: LandingPageProps) {
  const { t, i18n } = useTranslation();
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false);
  const [howItWorksTab, setHowItWorksTab] = useState<"merchant" | "customer">("merchant");
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);

  React.useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      // Update UI notify the user they can install the PWA
      setIsInstallable(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      return;
    }
    // Show the install prompt
    deferredPrompt.prompt();
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    // We've used the prompt, and can't use it again, throw it away
    setDeferredPrompt(null);
    setIsInstallable(false);
  };

  const isRtl = (i18n.language || "ar").startsWith("ar");

  const features = [
    {
      icon: <QrCode className="w-8 h-8 text-indigo-600" />,
      title: t("feat_qr_title"),
      desc: t("feat_qr_desc")
    },
    {
      icon: <Clock className="w-8 h-8 text-indigo-600" />,
      title: t("feat_sync_title"),
      desc: t("feat_sync_desc")
    },
    {
      icon: <Bell className="w-8 h-8 text-indigo-600" />,
      title: t("feat_bell_title"),
      desc: t("feat_bell_desc")
    },
    {
      icon: <Store className="w-8 h-8 text-indigo-600" />,
      title: t("feat_vendor_title"),
      desc: t("feat_vendor_desc")
    }
  ];

  const plans: PlanItem[] = [
    {
      name: t("plan_free_name"),
      price: t("plan_free_price"),
      period: t("plan_free_period"),
      description: t("plan_free_desc"),
      features: [
        t("plan_free_f1"),
        t("plan_free_f2"),
        t("plan_free_f3"),
        t("plan_free_f4"),
        t("plan_free_f5")
      ],
      cta: t("plan_free_cta"),
      popular: false
    },
    {
      name: t("plan_pro_name"),
      price: t("plan_pro_price"),
      period: t("plan_pro_period"),
      description: t("plan_pro_desc"),
      features: [
        t("plan_pro_f1"),
        t("plan_pro_f2"),
        t("plan_pro_f3"),
        t("plan_pro_f4"),
        t("plan_pro_f5"),
        t("plan_pro_f6")
      ],
      cta: t("plan_pro_cta"),
      popular: true
    }
  ];

  const faqs: FAQItem[] = [
    {
      question: t("faq_1_q"),
      answer: t("faq_1_a")
    },
    {
      question: t("faq_2_q"),
      answer: t("faq_2_a")
    },
    {
      question: t("faq_3_q"),
      answer: t("faq_3_a")
    },
    {
      question: t("faq_4_q"),
      answer: t("faq_4_a")
    }
  ];

  return (
    <div className={`min-h-screen transition-colors duration-200 ${isDarkMode ? "dark bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-800"} selection:bg-indigo-500 selection:text-white ${isRtl ? "text-right" : "text-left"}`}>
      {/* Navbar */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-100 dark:border-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-800 flex items-center justify-center text-white shadow-md shadow-indigo-200">
              <Users className="w-6 h-6" />
            </div>
            <span className="text-2xl font-black bg-gradient-to-r from-indigo-600 to-indigo-900 bg-clip-text text-transparent">
              {t("logo_title")}
            </span>
            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-full">
              {t("digital_queues")}
            </span>
          </div>
          
          <nav className="hidden md:flex items-center gap-8 text-sm font-bold text-slate-600 dark:text-slate-400">
            <a href="#features" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">{t("navbar_features")}</a>
            <a href="#pricing" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">{t("navbar_pricing")}</a>
            <a href="#faq" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">{t("navbar_faq")}</a>
            <button 
              onClick={() => setIsHowItWorksOpen(true)}
              className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer text-sm font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1"
            >
              <span>{t("how_it_works_btn")}</span>
            </button>
          </nav>

          <div className="flex items-center gap-3">
            <LanguageSwitcher />

            {/* Built-in QR Scanner Header Action */}
            <button
              onClick={() => setIsQrScannerOpen(true)}
              className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-all flex items-center justify-center cursor-pointer shadow-sm hover:scale-105"
              title={isRtl ? "مسح رمز QR للمحل" : "Scan Shop QR Code"}
            >
              <QrCode className="w-4 h-4" />
            </button>

            {/* Dark Mode Toggle Button */}
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`p-2.5 rounded-xl transition-all flex items-center justify-center cursor-pointer ${
                isDarkMode 
                  ? "bg-slate-800 text-amber-400 hover:bg-slate-700" 
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              }`}
              title={isDarkMode ? (isRtl ? "تفعيل الوضع المضيء" : "Enable Light Mode") : (isRtl ? "تفعيل الوضع الداكن" : "Enable Dark Mode")}
            >
              {isDarkMode ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>

            {isInstallable && (
              <button
                onClick={handleInstallClick}
                className="flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 text-sm font-bold px-3 py-2 sm:px-4 sm:py-2 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">{isRtl ? "تثبيت التطبيق" : "Install App"}</span>
                <span className="sm:hidden">{isRtl ? "تثبيت" : "Install"}</span>
              </button>
            )}

            {userLoggedIn ? (
              <button 
                onClick={onGoToDashboard}
                className="bg-indigo-600 text-white text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-indigo-700 active:scale-95 transition-all shadow-md shadow-indigo-100 flex items-center gap-1.5 cursor-pointer"
              >
                <span>{t("dashboard")}</span>
                <ArrowRight className={`w-4 h-4 ${isRtl ? "rotate-180" : ""}`} />
              </button>
            ) : (
              <>
                <button 
                  onClick={onGoToDashboard}
                  className="text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white text-sm font-bold px-4 py-2 transition-colors cursor-pointer"
                >
                  {t("login")}
                </button>
                <button 
                  onClick={onStart}
                  className="bg-indigo-600 text-white text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-indigo-700 active:scale-95 transition-all shadow-md shadow-indigo-100 cursor-pointer"
                >
                  {t("register_shop")}
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 lg:py-28 bg-gradient-to-b from-white to-slate-50 dark:from-slate-950 dark:to-slate-900">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(99,102,241,0.05),transparent_50%)]" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Hero Left Info */}
            <div className={`lg:col-span-7 space-y-8 text-center ${isRtl ? "lg:text-right" : "lg:text-left"}`}>
              <motion.div 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="inline-flex items-center gap-2 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/40 text-indigo-700 dark:text-indigo-400 px-3.5 py-1.5 rounded-full text-xs font-bold"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{t("hero_tag")}</span>
              </motion.div>
 
              <motion.h1 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 dark:text-white leading-[1.2] lg:leading-[1.15]"
              >
                {t("hero_title_part1")} <span className="bg-gradient-to-r from-indigo-600 to-indigo-800 bg-clip-text text-transparent">{t("hero_title_part2")}</span>
              </motion.h1>
 
              <motion.p 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto lg:mx-0 leading-relaxed font-semibold"
              >
                {t("hero_desc")}
              </motion.p>
 
              <motion.div 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start flex-wrap"
              >
                <button 
                  onClick={onStart}
                  className="bg-indigo-600 text-white text-base font-black px-8 py-4 rounded-2xl hover:bg-indigo-700 active:scale-98 transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2.5 cursor-pointer"
                >
                  <span>{t("hero_cta_create")}</span>
                  <ArrowRight className={`w-5 h-5 ${isRtl ? "rotate-180" : ""}`} />
                </button>
                <button 
                  onClick={() => setIsQrScannerOpen(true)}
                  className="bg-emerald-600 text-white text-base font-black px-8 py-4 rounded-2xl hover:bg-emerald-700 active:scale-98 hover:scale-[1.02] transition-all flex items-center justify-center gap-2.5 cursor-pointer shadow-lg shadow-emerald-200 dark:shadow-none font-sans"
                >
                  <QrCode className="w-5 h-5 shrink-0" />
                  <span>{isRtl ? "مسح كود المحل للانضمام" : "Scan QR to Join Queue"}</span>
                </button>
                <button 
                  onClick={() => setIsHowItWorksOpen(true)}
                  className="bg-[#ffffff] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[#2a2f70] dark:text-slate-200 hover:bg-[#f8fafc] dark:hover:bg-slate-800 hover:border-[#f1f5f9] dark:hover:border-slate-700 text-base font-black px-8 py-4 rounded-2xl active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md hover:scale-[1.02]"
                >
                  <HelpCircle className="w-5 h-5 text-[#2a2f70] dark:text-indigo-400 shrink-0" />
                  <span>{t("how_it_works_btn")}</span>
                </button>
                {isInstallable && (
                  <button 
                    onClick={handleInstallClick}
                    className="bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400 text-base font-black px-8 py-4 rounded-2xl hover:bg-indigo-100 dark:hover:bg-indigo-900/50 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm hover:scale-[1.02]"
                  >
                    <Download className="w-5 h-5" />
                    <span>{isRtl ? "تثبيت التطبيق" : "Install App"}</span>
                  </button>
                )}
                <button 
                  onClick={() => {
                    const el = document.getElementById("features");
                    el?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-base font-bold px-8 py-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-950 dark:hover:text-white active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>{t("hero_cta_explore")}</span>
                </button>
              </motion.div>
 
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="grid grid-cols-3 gap-6 pt-6 border-t border-slate-100 dark:border-slate-850 max-w-md mx-auto lg:mx-0"
              >
                <div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white">100%</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-bold">{t("no_app_needed")}</div>
                </div>
                <div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white">{t("sec")}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-bold">{t("instant_sync")}</div>
                </div>
                <div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white">RTL</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-bold">{t("rtl_support")}</div>
                </div>
              </motion.div>
            </div>

            {/* Hero Right Graphic */}
            <div className="lg:col-span-5 relative flex justify-center">
              <div className="relative w-72 sm:w-80">
                {/* Visual airplane boarding-pass ticket mock */}
                <motion.div 
                  initial={{ rotate: -5, y: 20, opacity: 0 }}
                  animate={{ rotate: -3, y: 0, opacity: 1 }}
                  transition={{ type: "spring", damping: 15 }}
                  className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-xl overflow-hidden relative z-20"
                >
                  {/* Ticket Header */}
                  <div className="bg-indigo-900 text-white p-5 text-center">
                    <div className="text-xs opacity-75 font-bold mb-1">{t("mock_shop_name")}</div>
                    <div className="text-lg font-black tracking-tight">{t("mock_ticket_title")}</div>
                  </div>

                  <div className="p-6 space-y-6 text-center">
                    <div>
                      <span className="text-xs text-slate-400 font-bold block mb-1">{t("mock_queue_number")}</span>
                      <span className="text-6xl font-black text-indigo-600 tracking-tight">07</span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 border-t border-b border-dashed border-slate-200 dark:border-slate-800 py-4">
                      <div>
                        <span className="text-xs text-slate-400 font-semibold block">{t("mock_approx_wait")}</span>
                        <span className="text-base font-black text-slate-700 dark:text-slate-200">{t("mock_minutes")}</span>
                      </div>
                      <div>
                        <span className="text-xs text-slate-400 font-semibold block">{t("mock_people_ahead")}</span>
                        <span className="text-base font-black text-slate-700 dark:text-slate-200">{t("mock_two_people")}</span>
                      </div>
                    </div>

                    <div className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400 text-xs font-bold py-2 px-3 rounded-full flex items-center justify-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                      <span>{t("mock_calling_notification")}</span>
                    </div>

                    <div className="flex justify-center pt-2">
                      <QrCode className="w-20 h-20 text-slate-300 dark:text-slate-600" />
                    </div>
                  </div>
                </motion.div>

                {/* Decorative background circle */}
                <div className="absolute -top-12 -left-12 w-64 h-64 bg-indigo-100 dark:bg-indigo-950/20 rounded-full blur-3xl opacity-60 -z-10" />
                <div className="absolute -bottom-12 -right-12 w-64 h-64 bg-emerald-100 dark:bg-emerald-950/10 rounded-full blur-3xl opacity-40 -z-10" />
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-white dark:bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <h2 className="text-xs font-black text-indigo-600 tracking-wider uppercase">{t("features_section_title")}</h2>
            <p className="text-3xl sm:text-4xl font-black text-slate-950 dark:text-white">{t("features_section_subtitle")}</p>
            <p className="text-slate-600 dark:text-slate-300 text-base leading-relaxed">{t("features_section_desc")}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feat, index) => (
              <div key={index} className="bg-slate-50 dark:bg-slate-900 border border-slate-100/80 dark:border-slate-800 p-8 rounded-2xl hover:shadow-lg transition-all hover:-translate-y-1">
                <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-950/40 rounded-2xl flex items-center justify-center mb-6 text-indigo-600 dark:text-indigo-400">
                  {feat.icon}
                </div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white mb-3">{feat.title}</h3>
                <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 bg-slate-50 dark:bg-slate-950/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <h2 className="text-xs font-black text-indigo-600 tracking-wider uppercase font-sans">{t("pricing_title")}</h2>
            <p className="text-3xl sm:text-4xl font-black text-slate-950 dark:text-white">{t("pricing_subtitle")}</p>
            <p className="text-slate-600 dark:text-slate-300 text-base leading-relaxed">{t("pricing_desc")}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {plans.map((plan, index) => (
              <div 
                key={index} 
                className={`bg-white dark:bg-slate-900 border rounded-3xl p-8 relative flex flex-col justify-between transition-all ${
                  plan.popular 
                    ? "border-2 border-indigo-600 shadow-xl scale-105" 
                    : "border-slate-200 dark:border-slate-800 shadow-md"
                }`}
              >
                {plan.popular && (
                  <span className="absolute -top-4 right-1/2 translate-x-1/2 bg-gradient-to-r from-indigo-600 to-indigo-800 text-white text-xs font-black px-4 py-1.5 rounded-full shadow">
                    {t("pricing_popular_badge")}
                  </span>
                )}
                
                <div>
                  <div className="text-lg font-black text-slate-900 dark:text-white mb-2">{plan.name}</div>
                  <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">{plan.description}</p>
                  
                  <div className="flex items-baseline gap-1 mb-8">
                    <span className="text-4xl font-black text-slate-950 dark:text-white">{plan.price}</span>
                    <span className="text-slate-500 dark:text-slate-400 text-sm font-bold">{plan.period}</span>
                  </div>

                  <ul className="space-y-4 mb-8">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300 font-semibold">
                        <CheckCircle2 className="w-5 h-5 text-indigo-600 shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button 
                  onClick={onStart}
                  className={`w-full py-3.5 rounded-2xl text-sm font-black transition-all active:scale-97 cursor-pointer ${
                    plan.popular
                      ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100 dark:shadow-none"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-24 bg-white dark:bg-slate-950 border-t border-slate-100 dark:border-slate-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-xs font-black text-indigo-600 tracking-wider uppercase">{t("faq_section_title")}</h2>
            <p className="text-3xl font-black text-slate-950 dark:text-white">{t("faq_section_subtitle")}</p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => {
              const isOpen = activeFaq === index;
              return (
                <div key={index} className="border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden transition-all bg-slate-50 dark:bg-slate-900/40">
                  <button 
                    onClick={() => setActiveFaq(isOpen ? null : index)}
                    className={`w-full p-6 font-black text-slate-900 dark:text-white flex items-center justify-between gap-4 hover:bg-slate-100/50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer ${isRtl ? "text-right" : "text-left"}`}
                  >
                    <span>{faq.question}</span>
                    <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                  
                  {isOpen && (
                    <div className="p-6 pt-0 text-sm text-slate-600 dark:text-slate-300 leading-relaxed bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-850 font-semibold">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 text-slate-400 py-12 border-t border-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold">
              <Users className="w-5 h-5" />
            </div>
            <span className="text-xl font-black text-white">{t("logo_title")}</span>
          </div>

          <div className="text-sm text-slate-500 font-semibold">
            {t("footer_text", { year: new Date().getFullYear() })}
          </div>
        </div>
      </footer>

      {/* How It Works Modal */}
      {isHowItWorksOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity"
            onClick={() => setIsHowItWorksOpen(false)}
          />
          
          {/* Modal Box */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl relative z-10 flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white leading-tight">{t("how_it_works_title")}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-0.5">{t("how_it_works_subtitle")}</p>
                </div>
              </div>
              <button 
                onClick={() => setIsHowItWorksOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tab Switcher */}
            <div className="bg-slate-100/80 dark:bg-slate-950/50 p-1.5 mx-6 mt-6 rounded-2xl flex border border-slate-200/50 dark:border-slate-800/80">
              <button
                onClick={() => setHowItWorksTab("merchant")}
                className={`flex-1 py-3 text-center text-xs sm:text-sm font-black rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  howItWorksTab === "merchant"
                    ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm font-sans"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                <Store className="w-4 h-4 shrink-0" />
                <span>{t("how_it_works_merchant_tab")}</span>
              </button>
              <button
                onClick={() => setHowItWorksTab("customer")}
                className={`flex-1 py-3 text-center text-xs sm:text-sm font-black rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  howItWorksTab === "customer"
                    ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm font-sans"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                <Users className="w-4 h-4 shrink-0" />
                <span>{t("how_it_works_customer_tab")}</span>
              </button>
            </div>

            {/* Modal Body / Steps */}
            <div className="p-6 overflow-y-auto space-y-4 max-h-[50vh]">
              {howItWorksTab === "merchant" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Step 1 */}
                  <div className="flex gap-3.5 items-start bg-slate-50/50 dark:bg-slate-950/20 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/60 hover:border-indigo-100 dark:hover:border-indigo-950 transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 font-bold">
                      <Store className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900 dark:text-white">{t("how_m_step1_title")}</h4>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed font-semibold">{t("how_m_step1_desc")}</p>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="flex gap-3.5 items-start bg-slate-50/50 dark:bg-slate-950/20 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/60 hover:border-indigo-100 dark:hover:border-indigo-950 transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 font-bold">
                      <Printer className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900 dark:text-white">{t("how_m_step2_title")}</h4>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed font-semibold">{t("how_m_step2_desc")}</p>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="flex gap-3.5 items-start bg-slate-50/50 dark:bg-slate-950/20 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/60 hover:border-indigo-100 dark:hover:border-indigo-950 transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 font-bold">
                      <QrCode className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900 dark:text-white">{t("how_m_step3_title")}</h4>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed font-semibold">{t("how_m_step3_desc")}</p>
                    </div>
                  </div>

                  {/* Step 4 */}
                  <div className="flex gap-3.5 items-start bg-slate-50/50 dark:bg-slate-950/20 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/60 hover:border-indigo-100 dark:hover:border-indigo-950 transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 font-bold">
                      <Bell className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900 dark:text-white">{t("how_m_step4_title")}</h4>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed font-semibold">{t("how_m_step4_desc")}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Step 1 */}
                  <div className="flex gap-3.5 items-start bg-slate-50/50 dark:bg-slate-950/20 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/60 hover:border-indigo-100 dark:hover:border-indigo-950 transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 font-bold">
                      <QrCode className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900 dark:text-white">{t("how_c_step1_title")}</h4>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed font-semibold">{t("how_c_step1_desc")}</p>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="flex gap-3.5 items-start bg-slate-50/50 dark:bg-slate-950/20 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/60 hover:border-indigo-100 dark:hover:border-indigo-950 transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 font-bold">
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900 dark:text-white">{t("how_c_step2_title")}</h4>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed font-semibold">{t("how_c_step2_desc")}</p>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="flex gap-3.5 items-start bg-slate-50/50 dark:bg-slate-950/20 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/60 hover:border-indigo-100 dark:hover:border-indigo-950 transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 font-bold">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900 dark:text-white">{t("how_c_step3_title")}</h4>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed font-semibold">{t("how_c_step3_desc")}</p>
                    </div>
                  </div>

                  {/* Step 4 */}
                  <div className="flex gap-3.5 items-start bg-slate-50/50 dark:bg-slate-950/20 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/60 hover:border-indigo-100 dark:hover:border-indigo-950 transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 font-bold">
                      <Bell className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900 dark:text-white">{t("how_c_step4_title")}</h4>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed font-semibold">{t("how_c_step4_desc")}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/30 flex items-center justify-end">
              <button 
                onClick={() => setIsHowItWorksOpen(false)}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm rounded-xl transition-all active:scale-97 cursor-pointer shadow-md shadow-indigo-100"
              >
                {t("back_to_home")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Built-in QR Scanner Modal */}
      {isQrScannerOpen && (
        <Suspense fallback={<QrScannerFallback isOpen={isQrScannerOpen} onClose={() => setIsQrScannerOpen(false)} isRtl={isRtl} t={t} />}>
          <QrScannerModal
            isOpen={isQrScannerOpen}
            onClose={() => setIsQrScannerOpen(false)}
            onScanSuccess={(slug) => {
              setIsQrScannerOpen(false);
              onJoinShop(slug);
            }}
          />
        </Suspense>
      )}
    </div>
  );
}
