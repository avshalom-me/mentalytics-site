import { OWNER_VIEWER } from "@/app/lib/schools-crm.server";
import { remindersGet } from "@/app/lib/schools-api/workspace";

// התזכורות מלוח הענף שצריכות לקפוץ עכשיו לבעלים.

export const dynamic = "force-dynamic";

export const GET = () => remindersGet(OWNER_VIEWER);
