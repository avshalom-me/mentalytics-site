import KidsQuiz from "../kids/KidsQuiz";

// The counsellor rubric is the kids questionnaire - same areas, same branching,
// same scoring - with the counsellor's angle added inside each branch and a
// refinement screen before the report. See docs/school-questionnaire-plan.md.
export default function SchoolPage() {
  return <KidsQuiz audience="counselor" />;
}
