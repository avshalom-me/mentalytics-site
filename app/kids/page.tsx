import KidsQuiz from "./KidsQuiz";

// The questionnaire itself lives in KidsQuiz.tsx so that /school can render the
// same clinical flow for a counsellor. A page module may only export the fields
// Next.js knows, which is why the component is not exported from here.
export default function KidsPage() {
  return <KidsQuiz audience="parent" />;
}
