import { NextResponse } from "next/server";
import {
  KIDS_AQ_ITEMS,
  KIDS_MQ_ITEMS,
  KIDS_AS_ITEMS,
  KIDS_AG_ITEMS,
  KIDS_AB_ITEMS,
  KIDS_OQ_ITEMS,
  KIDS_TQ_ITEMS,
  KIDS_PQ_ITEMS,
  KIDS_BQ_ITEMS,
  KIDS_SENS_OVER_ITEMS,
  KIDS_SENS_UNDER_ITEMS,
  KIDS_ADHD_INATT,
  KIDS_ADHD_HYPER,
  KIDS_LSAS_ITEMS,
  KIDS_EA_RESTRICT,
  KIDS_EA_BINGE_UNDER12,
  KIDS_EB_RESTRICT,
  KIDS_EB_BINGE_OVER12,
} from "@/app/lib/questionnaire-items.server";

export async function GET() {
  return NextResponse.json({
    aq: KIDS_AQ_ITEMS,
    mq: KIDS_MQ_ITEMS,
    as: KIDS_AS_ITEMS,
    ag: KIDS_AG_ITEMS,
    ab: KIDS_AB_ITEMS,
    oq: KIDS_OQ_ITEMS,
    tq: KIDS_TQ_ITEMS,
    pq: KIDS_PQ_ITEMS,
    bq: KIDS_BQ_ITEMS,
    sensOver: KIDS_SENS_OVER_ITEMS,
    sensUnder: KIDS_SENS_UNDER_ITEMS,
    adhdInatt: KIDS_ADHD_INATT,
    adhdHyper: KIDS_ADHD_HYPER,
    lsas: KIDS_LSAS_ITEMS,
    eaRestrict: KIDS_EA_RESTRICT,
    eaBingeUnder12: KIDS_EA_BINGE_UNDER12,
    ebRestrict: KIDS_EB_RESTRICT,
    ebBingeOver12: KIDS_EB_BINGE_OVER12,
  }, { headers: { "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" } });
}
