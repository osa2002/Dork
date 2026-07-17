import { describe, it, expect } from "vitest";
import { Ticket } from "../../../types";
import {
  filterTicketsByDateRange,
  calculateWaitMetrics,
  calculateServiceMetrics,
  calculateAverageDurations,
  calculateSatisfactionMetrics,
  calculateLeaderboards,
  calculateDailySummary,
  calculateServiceDistribution,
  calculateKpis,
  calculateAnalyticsOverview,
} from "./analyticsCalculations";

describe("analyticsCalculations.ts Unit Tests", () => {
  const mockTickets: Ticket[] = [
    {
      id: "t1",
      shopId: "s1",
      serviceId: "srv1",
      serviceName: "Consultation",
      customerName: "Alice",
      ticketNumber: 101,
      status: "completed",
      createdAt: "2026-07-10T10:00:00.000Z",
      calledAt: "2026-07-10T10:15:00.000Z", // 15 mins wait
      completedAt: "2026-07-10T10:30:00.000Z", // 15 mins service
      rating: 5,
      ratingSpeed: 4,
      ratingQuality: 5,
    },
    {
      id: "t2",
      shopId: "s1",
      serviceId: "srv1",
      serviceName: "Consultation",
      customerName: "Bob",
      ticketNumber: 102,
      status: "completed",
      createdAt: "2026-07-11T11:00:00.000Z",
      calledAt: "2026-07-11T11:05:00.000Z", // 5 mins wait
      completedAt: "2026-07-11T11:25:00.000Z", // 20 mins service
      rating: 4,
      ratingSpeed: 5,
      ratingQuality: 4,
      counterNumber: "2",
    },
    {
      id: "t3",
      shopId: "s1",
      serviceId: "srv2",
      serviceName: "Support",
      customerName: "Charlie",
      ticketNumber: 103,
      status: "cancelled",
      createdAt: "2026-07-11T12:00:00.000Z",
    },
    {
      id: "t4",
      shopId: "s1",
      serviceId: "srv2",
      serviceName: "Support",
      customerName: "Diana",
      ticketNumber: 104,
      status: "no_show",
      createdAt: "2026-07-12T14:00:00.000Z",
    },
    {
      id: "t5",
      shopId: "s1",
      serviceId: "srv1",
      serviceName: "Consultation",
      customerName: "Evan",
      ticketNumber: 105,
      status: "waiting",
      createdAt: "2026-07-12T15:00:00.000Z",
    },
  ];

  describe("filterTicketsByDateRange", () => {
    it("should return empty array if input tickets array is null or undefined", () => {
      expect(filterTicketsByDateRange(null as any, "2026-07-10", "2026-07-12")).toEqual([]);
    });

    it("should correctly filter tickets within the range inclusive", () => {
      const filtered = filterTicketsByDateRange(mockTickets, "2026-07-10", "2026-07-11");
      expect(filtered.length).toBe(3);
      expect(filtered.map((t) => t.id)).toContain("t1");
      expect(filtered.map((t) => t.id)).toContain("t2");
      expect(filtered.map((t) => t.id)).toContain("t3");
      expect(filtered.map((t) => t.id)).not.toContain("t4");
    });
  });

  describe("calculateWaitMetrics", () => {
    it("should return 0 for empty arrays", () => {
      expect(calculateWaitMetrics([])).toBe(0);
    });

    it("should calculate average wait time in minutes", () => {
      const completed = mockTickets.filter((t) => t.status === "completed");
      // t1: 15 mins, t2: 5 mins. Total: 20 mins. Count: 2. Avg: 10 mins.
      expect(calculateWaitMetrics(completed)).toBe(10);
    });
  });

  describe("calculateServiceMetrics", () => {
    it("should return 0 for empty arrays", () => {
      expect(calculateServiceMetrics([])).toBe(0);
    });

    it("should calculate average service time in minutes", () => {
      const completed = mockTickets.filter((t) => t.status === "completed");
      // t1: 15 mins, t2: 20 mins. Total: 35 mins. Count: 2. Avg: 17.5 rounded to 18.
      expect(calculateServiceMetrics(completed)).toBe(18);
    });
  });

  describe("calculateAverageDurations", () => {
    it("should calculate both average wait and service minutes", () => {
      const completed = mockTickets.filter((t) => t.status === "completed");
      const result = calculateAverageDurations(completed);
      expect(result.averageWaitMinutes).toBe(10);
      expect(result.averageServiceMinutes).toBe(18);
    });
  });

  describe("calculateSatisfactionMetrics", () => {
    it("should return all scores as 0 if there are no ratings", () => {
      const emptyRatings = calculateSatisfactionMetrics([]);
      expect(emptyRatings.satisfactionScore).toBe(0);
      expect(emptyRatings.speedScore).toBe(0);
      expect(emptyRatings.qualityScore).toBe(0);
    });

    it("should compute average satisfaction, speed, and quality ratings", () => {
      const completed = mockTickets.filter((t) => t.status === "completed");
      const metrics = calculateSatisfactionMetrics(completed);
      // t1: rating=5, ratingSpeed=4, ratingQuality=5
      // t2: rating=4, ratingSpeed=5, ratingQuality=4
      // Average: satisfaction = 4.5, speed = 4.5, quality = 4.5
      expect(metrics.satisfactionScore).toBe(4.5);
      expect(metrics.speedScore).toBe(4.5);
      expect(metrics.qualityScore).toBe(4.5);
    });
  });

  describe("calculateLeaderboards", () => {
    it("should calculate leaderboards correctly", () => {
      const completed = mockTickets.filter((t) => t.status === "completed");
      const leaderboards = calculateLeaderboards(completed);
      
      // t1 has counterNumber undefined/null, fallback is "Counter 1"
      // t2 has counterNumber "2" -> "Counter 2"
      expect(leaderboards.length).toBe(2);
      expect(leaderboards[0].completed).toBe(1);
      expect(leaderboards[1].completed).toBe(1);
    });
  });

  describe("calculateDailySummary", () => {
    it("should generate zero-filled summary for each day in range", () => {
      const summary = calculateDailySummary([], "2026-07-10", "2026-07-12");
      expect(summary.length).toBe(3);
      expect(summary[0]).toEqual({ date: "2026-07-10", completed: 0, cancelled: 0, waiting: 0 });
    });

    it("should aggregate tickets status by day", () => {
      const summary = calculateDailySummary(mockTickets, "2026-07-10", "2026-07-12");
      expect(summary.length).toBe(3);
      // 2026-07-10: t1 (completed)
      expect(summary[0]).toEqual({ date: "2026-07-10", completed: 1, cancelled: 0, waiting: 0 });
      // 2026-07-11: t2 (completed), t3 (cancelled)
      expect(summary[1]).toEqual({ date: "2026-07-11", completed: 1, cancelled: 1, waiting: 0 });
      // 2026-07-12: t4 (no_show), t5 (waiting)
      expect(summary[2]).toEqual({ date: "2026-07-12", completed: 0, cancelled: 0, waiting: 1 });
    });
  });

  describe("calculateServiceDistribution", () => {
    it("should return distribution counts", () => {
      const distribution = calculateServiceDistribution(mockTickets);
      expect(distribution).toContainEqual({ name: "Consultation", value: 3 });
      expect(distribution).toContainEqual({ name: "Support", value: 2 });
    });
  });

  describe("calculateKpis", () => {
    it("should count completed, cancelled, no-show, and total tickets", () => {
      const kpis = calculateKpis(mockTickets);
      expect(kpis.totalReportCount).toBe(5);
      expect(kpis.completedReportCount).toBe(2);
      expect(kpis.cancelledReportCount).toBe(1);
      expect(kpis.noShowReportCount).toBe(1);
    });
  });

  describe("calculateAnalyticsOverview", () => {
    it("should compile complete payload for reports and analytics", () => {
      const overview = calculateAnalyticsOverview(mockTickets, "2026-07-10", "2026-07-12");
      expect(overview.totalReportCount).toBe(5);
      expect(overview.completedReportCount).toBe(2);
      expect(overview.averageReportWaitMinutes).toBe(10);
      expect(overview.averageReportServiceMinutes).toBe(18);
      expect(overview.satisfactionScore).toBe(4.5);
      expect(overview.speedScore).toBe(4.5);
      expect(overview.qualityScore).toBe(4.5);
      expect(overview.staffLeaderboard.length).toBe(2);
      expect(overview.dailyTrends.length).toBe(3);
    });
  });
});
