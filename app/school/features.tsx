"use client";

import { createContext, useContext } from "react";
import { ALL_FEATURES_ON, type SchoolFeatureFlags } from "@/app/lib/schools-crm";

// היכולות הפתוחות לרישיון של בית הספר (מצב "גפ״ן"). SchoolGate מציב את הערך מתשובת
// /api/school-access; מי שמחוץ ל-SchoolGate (ההורים, האתר הציבורי) מקבל את ברירת
// המחדל, הכול דלוק, כך שהקומפוננטות המשותפות לא משתנות בשבילם.
//
// הסתרה בממשק היא נוחות בלבד. החסימה האמיתית בשרת: app/lib/school-features.server.ts.
export const SchoolFeaturesContext = createContext<SchoolFeatureFlags>(ALL_FEATURES_ON);

export function useSchoolFeatures(): SchoolFeatureFlags {
  return useContext(SchoolFeaturesContext);
}
