import { Shop, Ticket, Service, Display, Invoice, WorkingHoursDay } from "../../types";

export interface VendorShopState {
  shop: Shop | null;
  shopLoading: boolean;
  shopError: string | null;
}

export interface VendorShopActions {
  setShop: (shop: Shop | null) => void;
  setShopLoading: (loading: boolean) => void;
  setShopError: (error: string | null) => void;
  subscribeToShop: (shopId: string) => () => void;
  updateShopSettings: (shopId: string, updates: Partial<Shop>) => Promise<void>;
  updateCounterStatus: (shopId: string, counterNumber: string, status: "online" | "busy" | "break" | "offline") => Promise<void>;
}

export type VendorShopSlice = VendorShopState & VendorShopActions;


export interface SubscribeToTicketsOptions {
  getSoundEnabled: () => boolean;
  getBrowserNotificationsEnabled: () => boolean;
  sendBrowserNotification: (title: string, body: string) => void;
  t: any;
}

export interface VendorQueueState {
  tickets: Ticket[];
  allTickets: Ticket[];
  selectedQueueServiceId: string;
  activeCounterNumber: string;
  ticketsLoading: boolean;
  selectedTicket: Ticket | null;
  waitingTickets: Ticket[];
  calledTickets: Ticket[];
  completedTickets: Ticket[];
  cancelledTickets: Ticket[];
  queueStats: {
    waitingCount: number;
    callingCount: number;
    completedCount: number;
    cancelledCount: number;
  };
  callProgress: string | null;
  isRefreshing: boolean;
}

export interface VendorQueueActions {
  setTickets: (tickets: Ticket[]) => void;
  setAllTickets: (tickets: Ticket[]) => void;
  setSelectedQueueServiceId: (serviceId: string) => void;
  setActiveCounterNumber: (counterNumber: string) => void;
  subscribeToTickets: (
    shopId: string,
    timezone: string,
    getClientStartOfTodayInTimezone: (timezone: string) => Date,
    options: SubscribeToTicketsOptions
  ) => () => void;
  callNextTicket: (
    selectedQueueServiceId: string,
    activeCounterNumber: string,
    announceCallingTicket: (ticketNumber: string, counterNumber: string, serviceName: string) => void,
    t: any
  ) => Promise<void>;
  handleCallTicket: (
    ticket: Ticket,
    activeCounterNumber: string,
    announceCallingTicket: (ticketNumber: string, counterNumber: string, serviceName: string) => void
  ) => Promise<void>;
  handleUpdateTicketStatus: (ticketId: string, status: "completed" | "cancelled" | "no_show" | "waiting") => Promise<void>;
  handleTogglePriority: (ticketId: string, currentPriority: boolean) => Promise<void>;
  
  // Phase 3 aliases & additional operations
  callTicket: (
    ticket: Ticket,
    activeCounterNumber: string,
    announceCallingTicket: (ticketNumber: string, counterNumber: string, serviceName: string) => void
  ) => Promise<void>;
  completeTicket: (ticketId: string) => Promise<void>;
  cancelTicket: (ticketId: string) => Promise<void>;
  recallTicket: (
    ticket: Ticket,
    activeCounterNumber: string,
    announceCallingTicket: (ticketNumber: string, counterNumber: string, serviceName: string) => void
  ) => Promise<void>;
  updateTicketPriority: (ticketId: string, currentPriority: boolean) => Promise<void>;
  clearWaitingTickets: (shopId: string, serviceId?: string) => Promise<void>;
  refreshQueue: () => void;
}

export type VendorQueueSlice = VendorQueueState & VendorQueueActions;


export interface VendorServiceState {
  services: Service[];
  serviceActionLoading: boolean;
  newServiceName: string;
  newServiceDuration: number;
}

export interface VendorServiceActions {
  setServices: (services: Service[]) => void;
  setServiceActionLoading: (loading: boolean) => void;
  setNewServiceName: (name: string) => void;
  setNewServiceDuration: (duration: number) => void;
  subscribeToServices: (shopId: string) => () => void;
  addService: (shopId: string) => Promise<void>;
  handleToggleService: (serviceId: string, currentStatus: boolean) => Promise<void>;
  handleDeleteService: (serviceId: string) => Promise<void>;
}

export type VendorServiceSlice = VendorServiceState & VendorServiceActions;


export interface VendorDisplayState {
  displays: Display[];
  editingDisplayId: string | null;
  editingDisplayName: string;
  refreshingDisplayId: string | null;
}

export interface VendorDisplayActions {
  setDisplays: (displays: Display[]) => void;
  setEditingDisplayId: (id: string | null) => void;
  setEditingDisplayName: (name: string) => void;
  setRefreshingDisplayId: (id: string | null) => void;
  subscribeToDisplays: (shopId: string) => () => void;
  handleRenameDisplay: (displayId: string) => Promise<void>;
  handleDeleteDisplay: (displayId: string) => Promise<void>;
  handleRequestRefresh: (displayId: string) => Promise<void>;
}

export type VendorDisplaySlice = VendorDisplayState & VendorDisplayActions;


export interface VendorBillingState {
  invoices: Invoice[];
  stripeLoading: boolean;
  stripeError: string | null;
  stripeVerifying: boolean;
  stripeVerifySuccess: boolean;
  stripeVerifyError: string | null;
  paymentLoading: boolean;
  paymentSuccess: boolean;
  paymentError: string | null;
  cardNumber: string;
  expiryDate: string;
  cvv: string;
  cardName: string;
}

export interface VendorBillingActions {
  setInvoices: (invoices: Invoice[]) => void;
  setStripeLoading: (loading: boolean) => void;
  setStripeError: (error: string | null) => void;
  setStripeVerifying: (verifying: boolean) => void;
  setStripeVerifySuccess: (success: boolean) => void;
  setStripeVerifyError: (error: string | null) => void;
  setPaymentLoading: (loading: boolean) => void;
  setPaymentSuccess: (success: boolean) => void;
  setPaymentError: (error: string | null) => void;
  setCardNumber: (num: string) => void;
  setExpiryDate: (date: string) => void;
  setCvv: (cvv: string) => void;
  setCardName: (name: string) => void;
  subscribeToInvoices: (shopId: string) => () => void;
  handleUpgradePlan: (shopId: string, planType: "pro") => Promise<void>;
  handleMockPaymentSubmit: (shopId: string, t: any, e?: any) => Promise<void>;
  verifyStripePayment: (sessionId: string) => Promise<void>;
}

export type VendorBillingSlice = VendorBillingState & VendorBillingActions;


export interface VendorAnalyticsState {
  timeRange: "today" | "7days" | "30days";
  reportStartDate: string;
  reportEndDate: string;
  exportLoading: boolean;
  reportError: string | null;
  aiAnalysis: string;
  aiLoading: boolean;
  aiError: string | null;
  historicalTickets: Ticket[];
  historicalLoading: boolean;
}

export interface VendorAnalyticsActions {
  setTimeRange: (range: "today" | "7days" | "30days") => void;
  setReportStartDate: (date: string) => void;
  setReportEndDate: (date: string) => void;
  setExportLoading: (loading: boolean) => void;
  setReportError: (error: string | null) => void;
  setAiAnalysis: (analysis: string) => void;
  setAiLoading: (loading: boolean) => void;
  setAiError: (error: string | null) => void;
  handleRequestAiDiagnostics: (allTickets: Ticket[]) => Promise<void>;
  handleExportCSV: (filteredReportTickets: Ticket[], t: any) => Promise<void>;
  fetchHistoricalTickets: (shopId: string, startDateStr: string, endDateStr: string) => Promise<void>;
}

export type VendorAnalyticsSlice = VendorAnalyticsState & VendorAnalyticsActions;


export interface VendorSettingsState {
  editShopName: string;
  editShopLogoText: string;
  editShopCategory: string;
  editShopLogoUrl: string;
  editShopTicketColor: string;
  editDisplayBgTheme: string;
  editDisplayAnimatedBg: boolean;
  workingHoursEnabled: boolean;
  workingHoursDays: { [key: string]: WorkingHoursDay };
  settingsSaving: boolean;
  settingsSuccess: boolean;
  settingsError: string | null;
  counterStatus: "online" | "busy" | "break" | "offline";
  soundEnabled: boolean;
  voiceAnnouncementsEnabled: boolean;
  voiceLanguage: string;
  voiceRate: number;
  browserNotificationsEnabled: boolean;
  maxWaitTimeAlertMinutes: number;
}

export interface VendorSettingsActions {
  setEditShopName: (name: string) => void;
  setEditShopLogoText: (text: string) => void;
  setEditShopCategory: (category: string) => void;
  setEditShopLogoUrl: (url: string) => void;
  setEditShopTicketColor: (color: string) => void;
  setEditDisplayBgTheme: (theme: string) => void;
  setEditDisplayAnimatedBg: (enabled: boolean) => void;
  setWorkingHoursEnabled: (enabled: boolean) => void;
  setWorkingHoursDays: (days: { [key: string]: WorkingHoursDay }) => void;
  setSettingsSaving: (saving: boolean) => void;
  setSettingsSuccess: (success: boolean) => void;
  setSettingsError: (error: string | null) => void;
  setCounterStatus: (status: "online" | "busy" | "break" | "offline") => void;
  setSoundEnabled: (enabled: boolean) => void;
  setVoiceAnnouncementsEnabled: (enabled: boolean) => void;
  setVoiceLanguage: (lang: string) => void;
  setVoiceRate: (rate: number) => void;
  setBrowserNotificationsEnabled: (enabled: boolean) => void;
  setMaxWaitTimeAlertMinutes: (minutes: number) => void;
  handleToggleWorkingHoursDay: (index: string) => void;
  handleWorkingHoursTimeChange: (index: string, type: "open" | "close", value: string) => void;
  handleSaveSettings: (shopId: string) => Promise<void>;
  handleToggleBrowserNotifications: () => Promise<void>;
  handleSendTestNotification: () => void;
  announceCallingTicket: (ticketNumber: string, counterNumber: string, serviceName: string, isRtl: boolean) => void;
}

export type VendorSettingsSlice = VendorSettingsState & VendorSettingsActions;


export type VendorState = 
  VendorShopSlice &
  VendorQueueSlice &
  VendorServiceSlice &
  VendorDisplaySlice &
  VendorBillingSlice &
  VendorAnalyticsSlice &
  VendorSettingsSlice;
