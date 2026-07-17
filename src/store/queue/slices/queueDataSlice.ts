import { StateCreator } from "zustand";
import { QueueState, QueueDataSlice } from "../types";

/**
 * queueDataSlice
 * 
 * Responsibility: Manages the core business entities of the queue.
 * This includes the active customer ticket (myTicket) and the list of 
 * today's tickets (todayTickets). It remains pure from side effects and
 * focuses solely on storing and updating business data.
 */
export const createQueueDataSlice: StateCreator<
  QueueState,
  [],
  [],
  QueueDataSlice
> = (set) => ({
  myTicket: null,
  todayTickets: [],
  estimatedWaitMinutes: 0,
  peopleInFront: 0,
  progressPercent: 0,
  calculatedAvgServiceTime: 0,
  activeCountersCount: 0,

  setMyTicket: (myTicket) => set({ myTicket }),
  setTodayTickets: (todayTickets) => set({ todayTickets }),
  setEstimatedWaitMinutes: (estimatedWaitMinutes) => set({ estimatedWaitMinutes }),
  setPeopleInFront: (peopleInFront) => set({ peopleInFront }),
  setProgressPercent: (progressPercent) => set({ progressPercent }),
  setCalculatedAvgServiceTime: (calculatedAvgServiceTime) => set({ calculatedAvgServiceTime }),
  setActiveCountersCount: (activeCountersCount) => set({ activeCountersCount }),
});
