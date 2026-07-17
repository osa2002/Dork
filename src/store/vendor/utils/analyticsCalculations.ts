import { Ticket } from "../../../types";

/**
 * Filter tickets by start and end date range (inclusive, matching the first part of ISO string).
 */
export function filterTicketsByDateRange(
  allTickets: Ticket[],
  startDate: string,
  endDate: string
): Ticket[] {
  if (!allTickets) return [];
  return allTickets.filter((ticket) => {
    if (!ticket.createdAt) return false;
    const createdDate = ticket.createdAt.split("T")[0];
    return createdDate >= startDate && createdDate <= endDate;
  });
}

/**
 * Calculates waiting metrics for completed tickets.
 */
export function calculateWaitMetrics(completedTickets: Ticket[]): number {
  const count = completedTickets.length;
  if (count === 0) return 0;

  const totalDiff = completedTickets.reduce((acc, ticket) => {
    if (ticket.calledAt && ticket.createdAt) {
      const diffMs = new Date(ticket.calledAt).getTime() - new Date(ticket.createdAt).getTime();
      return acc + Math.max(0, diffMs);
    }
    return acc;
  }, 0);

  return Math.round(totalDiff / count / 60000);
}

/**
 * Calculates service duration metrics for completed tickets.
 */
export function calculateServiceMetrics(completedTickets: Ticket[]): number {
  const count = completedTickets.length;
  if (count === 0) return 0;

  const totalDiff = completedTickets.reduce((acc, ticket) => {
    if (ticket.completedAt && ticket.calledAt) {
      const diffMs = new Date(ticket.completedAt).getTime() - new Date(ticket.calledAt).getTime();
      return acc + Math.max(0, diffMs);
    }
    return acc;
  }, 0);

  return Math.round(totalDiff / count / 60000);
}

/**
 * Calculates average durations (wait & service) in one pass.
 */
export function calculateAverageDurations(completedTickets: Ticket[]): {
  averageWaitMinutes: number;
  averageServiceMinutes: number;
} {
  return {
    averageWaitMinutes: calculateWaitMetrics(completedTickets),
    averageServiceMinutes: calculateServiceMetrics(completedTickets),
  };
}

/**
 * Computes satisfaction, speed, and quality score averages from rated completed tickets.
 */
export function calculateSatisfactionMetrics(completedTickets: Ticket[]): {
  satisfactionScore: number;
  speedScore: number;
  qualityScore: number;
} {
  const ratedSatisfaction = completedTickets.filter(
    (t) => t.rating !== undefined && t.rating !== null
  );
  const ratedSpeed = completedTickets.filter(
    (t) => t.ratingSpeed !== undefined && t.ratingSpeed !== null
  );
  const ratedQuality = completedTickets.filter(
    (t) => t.ratingQuality !== undefined && t.ratingQuality !== null
  );

  const satisfactionScore =
    ratedSatisfaction.length > 0
      ? Number(
          (
            ratedSatisfaction.reduce((acc, t) => acc + (t.rating || 0), 0) /
            ratedSatisfaction.length
          ).toFixed(1)
        )
      : 0;

  const speedScore =
    ratedSpeed.length > 0
      ? Number(
          (
            ratedSpeed.reduce((acc, t) => acc + (t.ratingSpeed || 0), 0) /
            ratedSpeed.length
          ).toFixed(1)
        )
      : 0;

  const qualityScore =
    ratedQuality.length > 0
      ? Number(
          (
            ratedQuality.reduce((acc, t) => acc + (t.ratingQuality || 0), 0) /
            ratedQuality.length
          ).toFixed(1)
        )
      : 0;

  return { satisfactionScore, speedScore, qualityScore };
}

/**
 * Computes staff performance and active leaderboards.
 */
export function calculateLeaderboards(completedTickets: Ticket[]): {
  name: string;
  completed: number;
  avgRating: number;
}[] {
  const staffMap: {
    [key: string]: { completed: number; ratings: number[]; sum: number };
  } = {};

  completedTickets.forEach((ticket) => {
    const staff =
      ticket.counterNumber || ticket.completedAt
        ? `Counter ${ticket.counterNumber || "1"}`
        : "";
    if (!staff) return;

    if (!staffMap[staff]) {
      staffMap[staff] = { completed: 0, ratings: [], sum: 0 };
    }
    staffMap[staff].completed += 1;
    if (ticket.rating) {
      staffMap[staff].ratings.push(ticket.rating);
      staffMap[staff].sum += ticket.rating;
    }
  });

  return Object.entries(staffMap)
    .map(([name, stats]) => {
      const avgRating =
        stats.ratings.length > 0
          ? Number((stats.sum / stats.ratings.length).toFixed(1))
          : 5.0;
      return { name, completed: stats.completed, avgRating };
    })
    .sort((a, b) => b.completed - a.completed);
}

/**
 * Computes daily load/activity trends over the specified report date range.
 */
export function calculateDailySummary(
  filteredTickets: Ticket[],
  startDate: string,
  endDate: string
): { date: string; completed: number; cancelled: number; waiting: number }[] {
  const daysMap: {
    [key: string]: { date: string; completed: number; cancelled: number; waiting: number };
  } = {};
  const dateList: string[] = [];

  // Populate map with dates in the range
  const start = new Date(startDate);
  const end = new Date(endDate);
  const temp = new Date(start);

  while (temp <= end) {
    const dayISO = temp.toISOString().split("T")[0];
    daysMap[dayISO] = { date: dayISO, completed: 0, cancelled: 0, waiting: 0 };
    dateList.push(dayISO);
    temp.setDate(temp.getDate() + 1);
  }

  filteredTickets.forEach((ticket) => {
    if (!ticket.createdAt) return;
    const dayISO = ticket.createdAt.split("T")[0];
    if (daysMap[dayISO]) {
      if (ticket.status === "completed") {
        daysMap[dayISO].completed += 1;
      } else if (ticket.status === "cancelled") {
        daysMap[dayISO].cancelled += 1;
      } else if (ticket.status === "waiting") {
        daysMap[dayISO].waiting += 1;
      }
    }
  });

  return dateList.map((d) => daysMap[d]);
}

/**
 * Calculates service utilization and distribution.
 */
export function calculateServiceDistribution(filteredTickets: Ticket[]): {
  name: string;
  value: number;
}[] {
  const serviceMap: { [key: string]: number } = {};
  filteredTickets.forEach((ticket) => {
    const service = ticket.serviceName || "Other";
    serviceMap[service] = (serviceMap[service] || 0) + 1;
  });
  return Object.entries(serviceMap).map(([name, value]) => ({ name, value }));
}

/**
 * Calculates KPI counters.
 */
export function calculateKpis(filteredTickets: Ticket[]): {
  totalReportCount: number;
  completedReportCount: number;
  cancelledReportCount: number;
  noShowReportCount: number;
} {
  let completed = 0;
  let cancelled = 0;
  let noShow = 0;

  filteredTickets.forEach((ticket) => {
    if (ticket.status === "completed") {
      completed += 1;
    } else if (ticket.status === "cancelled") {
      cancelled += 1;
    } else if (ticket.status === "no_show") {
      noShow += 1;
    }
  });

  return {
    totalReportCount: filteredTickets.length,
    completedReportCount: completed,
    cancelledReportCount: cancelled,
    noShowReportCount: noShow,
  };
}

/**
 * Orchestrates and returns a complete, memoized-friendly analytics overview payload.
 */
export function calculateAnalyticsOverview(
  allTickets: Ticket[],
  startDate: string,
  endDate: string
) {
  const filteredReportTickets = filterTicketsByDateRange(allTickets, startDate, endDate);
  const completedReportTickets = filteredReportTickets.filter((t) => t.status === "completed");

  const { averageWaitMinutes, averageServiceMinutes } = calculateAverageDurations(
    completedReportTickets
  );
  const { satisfactionScore, speedScore, qualityScore } = calculateSatisfactionMetrics(
    completedReportTickets
  );
  const staffLeaderboard = calculateLeaderboards(completedReportTickets);
  const dailyTrends = calculateDailySummary(filteredReportTickets, startDate, endDate);
  const serviceDistribution = calculateServiceDistribution(filteredReportTickets);
  const kpis = calculateKpis(filteredReportTickets);

  return {
    filteredReportTickets,
    ...kpis,
    averageReportWaitMinutes: averageWaitMinutes,
    averageReportServiceMinutes: averageServiceMinutes,
    satisfactionScore,
    speedScore,
    qualityScore,
    staffLeaderboard,
    dailyTrends,
    serviceDistribution,
  };
}
