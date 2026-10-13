"use client";

import { usePathname } from "next/navigation";
import PageViewTracker from "@/app/components/PageViewTracker";
import { learningDoorPageName } from "@/app/lib/learning-door";

/**
 * page_view for the door itself (/learning), mounted from the layout.
 *
 * The door has been open to Google since 3/10/2026 with no page_view at all,
 * so an organic visit to it was invisible in the patient funnel and in the
 * landing-page reports. It lives in the layout rather than in page.tsx so that
 * a measurement change does not move the page's declared revision date (the
 * page file is a source of its <lastmod> in page-revised.ts). Only the door
 * is counted: the teachers' join page is a recruitment page, which stays out
 * of page_view the way /therapists/join does, and the private pages are never
 * counted.
 */
export default function LearningDoorTracker() {
  const page = learningDoorPageName(usePathname());
  return page ? <PageViewTracker page={page} source="learning" /> : null;
}
