import { NextResponse } from "next/server";
import {
  ADULTS_REGIONS,
  ADULTS_CULTURAL_PREFS,
  MOOD_ITEMS,
  MANIA_ITEMS,
  PRODROME_ITEMS,
  GAD7_ITEMS,
  OCD_ITEMS,
  SLEEP_ITEMS,
  TRAUMA_ITEMS,
  PERS_ITEMS,
  EXEC_ITEMS,
  LD_ITEMS,
  EFT_ITEMS,
  DYN_ITEMS,
  STRUCT_ITEMS,
  PORN_ITEMS,
  PHONE_ITEMS,
} from "@/app/lib/questionnaire-items.server";

export async function GET() {
  return NextResponse.json({
    regions: ADULTS_REGIONS,
    culturalPrefs: ADULTS_CULTURAL_PREFS,
    mood: MOOD_ITEMS,
    mania: MANIA_ITEMS,
    prodrome: PRODROME_ITEMS,
    gad7: GAD7_ITEMS,
    ocd: OCD_ITEMS,
    sleep: SLEEP_ITEMS,
    trauma: TRAUMA_ITEMS,
    pers: PERS_ITEMS,
    exec: EXEC_ITEMS,
    ld: LD_ITEMS,
    eft: EFT_ITEMS,
    dyn: DYN_ITEMS,
    struct: STRUCT_ITEMS,
    porn: PORN_ITEMS,
    phone: PHONE_ITEMS,
  }, { headers: { "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" } });
}
