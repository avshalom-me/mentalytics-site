import { branchAssignees } from "@/app/lib/schools-api/tasks";

// האחראים שאפשר להטיל עליהם משימה בענף בתי הספר: אנשי הצוות והשותפות.
// לאדמין; ב-CRM הראשי הרשימה נשארת אנשי הצוות בלבד (/api/admin-crm/assignees).

export const dynamic = "force-dynamic";

export const GET = () => branchAssignees();
