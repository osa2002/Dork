import { doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";

/**
 * feedbackRepository
 * 
 * Infrastructure repository encapsulating Firestore operations for customer feedback,
 * ratings, and service metrics on their completed tickets.
 */
export const feedbackRepository = {
  /**
   * Submits overall rating, speed rating, quality rating, and comments for a completed ticket.
   */
  async submitFeedback(
    ticketId: string,
    rating: number,
    ratingSpeed: number,
    ratingQuality: number,
    ratingComment: string
  ): Promise<void> {
    const ticketRef = doc(db, "tickets", ticketId);
    await updateDoc(ticketRef, {
      rating,
      ratingSpeed,
      ratingQuality,
      ratingComment: ratingComment.trim(),
      ratedAt: new Date().toISOString()
    });
  }
};
