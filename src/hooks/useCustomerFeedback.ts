import { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Ticket } from "../types";

export function useCustomerFeedback(myTicket: Ticket | null, isRtl: boolean) {
  const [rating, setRating] = useState<number>(0);
  const [ratingHover, setRatingHover] = useState<number>(0);
  const [ratingSpeed, setRatingSpeed] = useState<number>(0);
  const [ratingSpeedHover, setRatingSpeedHover] = useState<number>(0);
  const [ratingQuality, setRatingQuality] = useState<number>(0);
  const [ratingQualityHover, setRatingQualityHover] = useState<number>(0);
  const [showFeedbackForm, setShowFeedbackForm] = useState<boolean>(false);
  const [ratingComment, setRatingComment] = useState<string>("");
  const [submittingRating, setSubmittingRating] = useState<boolean>(false);
  const [ratingSuccess, setRatingSuccess] = useState<boolean>(false);

  const handleSubmitRating = async () => {
    if (!myTicket || ratingSpeed === 0 || ratingQuality === 0) return;
    setSubmittingRating(true);
    const overallRating = Math.round((ratingSpeed + ratingQuality) / 2);
    try {
      const ticketRef = doc(db, "tickets", myTicket.id);
      await updateDoc(ticketRef, {
        rating: overallRating,
        ratingSpeed: ratingSpeed,
        ratingQuality: ratingQuality,
        ratingComment: ratingComment.trim(),
        ratedAt: new Date().toISOString()
      });
      setRating(overallRating);
      setRatingSuccess(true);
    } catch (err) {
      console.error("Error submitting rating: ", err);
      alert(isRtl ? "حدث خطأ أثناء إرسال التقييم." : "An error occurred while submitting your rating.");
    } finally {
      setSubmittingRating(false);
    }
  };

  return {
    rating,
    setRating,
    ratingHover,
    setRatingHover,
    ratingSpeed,
    setRatingSpeed,
    ratingSpeedHover,
    setRatingSpeedHover,
    ratingQuality,
    setRatingQuality,
    ratingQualityHover,
    setRatingQualityHover,
    showFeedbackForm,
    setShowFeedbackForm,
    ratingComment,
    setRatingComment,
    submittingRating,
    ratingSuccess,
    handleSubmitRating
  };
}
