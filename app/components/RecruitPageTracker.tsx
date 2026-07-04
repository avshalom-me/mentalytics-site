"use client";

import { useRecruitPageView } from "@/app/lib/useTrack";

/**
 * Fires a recruit_page_view analytics event on mount. Mounted on therapist
 * recruitment landing pages (which are server components), so ad traffic is
 * counted in the /admin/recruitment funnel. Renders nothing.
 */
export default function RecruitPageTracker({ page }: { page: string }) {
  useRecruitPageView(page);
  return null;
}
