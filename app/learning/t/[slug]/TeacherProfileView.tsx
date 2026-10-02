"use client";

import { useEffect, useRef } from "react";
import { sendTeacherEvent } from "../../TeacherContactButtons";

/** רישום צפייה בפרופיל - פעם אחת לטעינה. */
export default function TeacherProfileView({ teacherId, quizType }: { teacherId: string; quizType: "kids" | "school" | null }) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    sendTeacherEvent("profile_view", [teacherId], { source: "profile", quizType });
  }, [teacherId, quizType]);
  return null;
}
