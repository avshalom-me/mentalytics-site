"use client";

import { useRecruitCtaClicks, useRecruitPageView } from "@/app/lib/useTrack";

/**
 * Fires a recruit_page_view analytics event on mount, and a recruit_cta_click
 * on every press of a register button on the page. Mounted on therapist
 * recruitment landing pages (which are server components), so ad traffic is
 * counted in the /admin/recruitment funnel. Renders nothing.
 */
export default function RecruitPageTracker({ page }: { page: string }) {
  useRecruitPageView(page);
  useRecruitCtaClicks(page);
  return null;
}
