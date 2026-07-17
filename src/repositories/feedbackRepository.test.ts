import { describe, it, expect, vi, beforeEach } from "vitest";
import { feedbackRepository } from "./feedbackRepository";
import { doc, updateDoc } from "firebase/firestore";

describe("Feedback Repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should successfully submit customer ratings, comment, and ISO timestamp to Firestore", async () => {
    const mockDocRef = { id: "test-ticket-id" };
    vi.mocked(doc).mockReturnValue(mockDocRef as any);

    await feedbackRepository.submitFeedback(
      "test-ticket-id",
      5,
      4,
      5,
      " Excellent service!  "
    );

    expect(doc).toHaveBeenCalledWith(expect.any(Object), "tickets", "test-ticket-id");
    expect(updateDoc).toHaveBeenCalledWith(
      mockDocRef,
      expect.objectContaining({
        rating: 5,
        ratingSpeed: 4,
        ratingQuality: 5,
        ratingComment: "Excellent service!",
        ratedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/), // ISO timestamp
      })
    );
  });
});
