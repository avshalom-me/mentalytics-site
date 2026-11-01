"use client";

import { usePathname } from "next/navigation";
import PageViewTracker from "@/app/components/PageViewTracker";
import { useRecruitPageView } from "@/app/lib/useTrack";
import { learningDoorPageName, learningRecruitPageName } from "@/app/lib/learning-door";

/**
 * Analytics for the learning door, mounted from the layout.
 *
 * The door has been open to Google since 3/10/2026 with no page_view at all,
 * so an organic visit to it was invisible in the patient funnel and in the
 * landing-page reports. It lives in the layout rather than in page.tsx so that
 * a measurement change does not move the page's declared revision date (the
 * page file is a source of its <lastmod> in page-revised.ts).
 *
 * The door and the teachers' directory are counted as page_view. The teachers'
 * join page is a recruitment page: it stays out of page_view the way
 * /therapists/join does, and is counted as recruit_page_view (source
 * "learning-join", with the visitor's channel and utm), so a registration can
 * be matched to its visits by channel. The private pages are never counted.
 *
 * The join page was added on 1/11/2026: the first three teachers all arrived
 * from ChatGPT (utm_source=chatgpt.com), and the page they landed on could not
 * be seen because the join page was not measured at all.
 */
function RecruitView({ page }: { page: string }) {
  useRecruitPageView(page);
  return null;
}

export default function LearningDoorTracker() {
  const pathname = usePathname();
  const page = learningDoorPageName(pathname);
  const recruitPage = learningRecruitPageName(pathname);
  if (recruitPage) return <RecruitView page={recruitPage} />;
  return page ? <PageViewTracker page={page} source="learning" /> : null;
}
