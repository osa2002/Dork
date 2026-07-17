import { Ticket, Shop } from "../../types";

export interface QueueDataState {
  myTicket: Ticket | null;
  todayTickets: Ticket[];
  estimatedWaitMinutes: number;
  peopleInFront: number;
  progressPercent: number;
  calculatedAvgServiceTime: number;
  activeCountersCount: number;
}

export interface QueueDataActions {
  setMyTicket: (ticket: Ticket | null) => void;
  setTodayTickets: (tickets: Ticket[]) => void;
  setEstimatedWaitMinutes: (minutes: number) => void;
  setPeopleInFront: (people: number) => void;
  setProgressPercent: (percent: number) => void;
  setCalculatedAvgServiceTime: (time: number) => void;
  setActiveCountersCount: (count: number) => void;
}

export type QueueDataSlice = QueueDataState & QueueDataActions;

export interface QueueUiState {
  joining: boolean;
  isOnline: boolean;
  errorMessage: string | null;
  showAlert: boolean;
  aiEstimateLoading: boolean;
  aiEstimateMessage: string;
}

export interface QueueUiActions {
  setJoining: (joining: boolean) => void;
  setIsOnline: (online: boolean) => void;
  setErrorMessage: (error: string | null) => void;
  setShowAlert: (show: boolean) => void;
  setAiEstimateLoading: (loading: boolean) => void;
  setAiEstimateMessage: (message: string) => void;
}

export type QueueUiSlice = QueueUiState & QueueUiActions;

export interface QueueSubscriptionActions {
  subscribeToTodayTickets: (shopId: string, timezone: string) => () => void;
  subscribeToMyTicket: (shopId: string, ticketId: string, isRtl: boolean, shopName: string, soundEnabled: boolean) => () => void;
  unsubscribeMyTicket: () => void;
  unsubscribeQueue: () => void;
}

export type QueueSubscriptionSlice = QueueSubscriptionActions;

export interface QueueSyncActions {
  syncOfflineTickets: (shop: Shop) => Promise<void>;
}

export type QueueSyncSlice = QueueSyncActions;

export interface JoinQueueParams {
  shop: Shop;
  serviceId: string;
  serviceName: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  emailNotify: boolean;
  smsNotify: boolean;
  whatsappNotify: boolean;
  isScheduled: boolean;
  scheduledDate: string;
  scheduledTime: string;
  isRtl: boolean;
  soundEnabled: boolean;
  setShowLimitModal: (show: boolean) => void;
}

export interface QueueActions {
  joinQueue: (params: JoinQueueParams) => Promise<void>;
  leaveQueue: (shopId: string, ticketId: string) => Promise<void>;
  cancelQueue: (shopId: string, ticketId: string) => Promise<void>;
  clearQueueState: () => void;
}

export type QueueActionsSlice = QueueActions;

export type QueueState = QueueDataSlice & QueueUiSlice & QueueSubscriptionSlice & QueueSyncSlice & QueueActionsSlice;
