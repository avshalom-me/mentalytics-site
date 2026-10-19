import KidsQuiz from "../kids/KidsQuiz";
import SchoolGate from "./SchoolGate";

// The counsellor rubric is the kids questionnaire - same areas, same branching,
// same scoring - with the counsellor's angle added inside each branch and a
// refinement screen before the report. See docs/school-questionnaire-plan.md.
//
// From 19/10/2026 the questionnaire is licensed to schools: SchoolGate asks for
// the school's access code when the gate is on (SCHOOL_GATE_ON), and the score
// route refuses a request without a valid licence (app/lib/school-gate.server.ts).
export default function SchoolPage() {
  return (
    <SchoolGate>
      <KidsQuiz audience="counselor" />
    </SchoolGate>
  );
}
