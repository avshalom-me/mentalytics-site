import "server-only";

// חיפוש מכונים ומרכזים טיפוליים דרך Google Places API (New).
//
// למה ה-API הרשמי ולא גרידה מאתרים: זה חוקי, יציב, ומחזיר טלפון וכתובת
// מובנים. התמחור (אוגוסט 2026): 5,000 קריאות חינם בחודש לכל SKU, ומעליהן
// $32 לאלף. בסדר הגודל שלנו - כמה עשרות חיפושים בריצה - זה נשאר בחינם,
// ולכן גם אין כאן מנגנון תקציב מסובך אלא רק תקרה קשיחה לריצה.
//
// שדות: מבקשים במפורש רק את מה שצריך. הוספת rating או reviews מקפיצה את
// הקריאה ל-SKU יקר יותר, ואין לנו בהם שימוש.

const ENDPOINT = "https://places.googleapis.com/v1/places:searchText";
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.nationalPhoneNumber",
  "places.websiteUri",
  "places.businessStatus",
].join(",");

// תקרת קריאות לריצה אחת - רשת ביטחון מול לולאה שיצאה משליטה.
const MAX_CALLS_PER_RUN = 60;

export type PlaceResult = {
  placeId: string;
  name: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  operational: boolean;
};

export function placesConfigured(): boolean {
  return Boolean(process.env.GOOGLE_PLACES_API_KEY);
}

type RawPlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  businessStatus?: string;
};

async function searchOnce(query: string): Promise<PlaceResult[]> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return [];
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    // languageCode/regionCode: בלעדיהם החיפוש בעברית מחזיר תוצאות מכל
    // העולם, ו-IL מצמצם אותו לישראל.
    body: JSON.stringify({ textQuery: query, languageCode: "he", regionCode: "IL", maxResultCount: 20 }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Places ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as { places?: RawPlace[] };
  return (json.places ?? [])
    .filter((p) => p.id && p.displayName?.text)
    .map((p) => ({
      placeId: p.id as string,
      name: (p.displayName?.text ?? "").trim(),
      address: p.formattedAddress ?? null,
      phone: p.nationalPhoneNumber ?? null,
      website: p.websiteUri ?? null,
      operational: (p.businessStatus ?? "OPERATIONAL") === "OPERATIONAL",
    }));
}

// מונחי החיפוש. מכוונים למרכז שמעסיק כמה מטפלים - לא לקליניקה של אדם
// אחד, שהמוצר שלה הוא מנוי מטפל רגיל ולא מנוי מרכז.
const TERMS = ["מרכז טיפולי", "מכון פסיכולוגי", "מרכז לטיפול רגשי", "מכון לפסיכותרפיה"];

export type PlacesSearchResult = {
  results: (PlaceResult & { city: string })[];
  calls: number;
  errors: string[];
};

/** חיפוש על פני רשימת ערים. מחזיר תוצאות ייחודיות לפי place_id. */
export async function searchCentersInCities(cities: string[]): Promise<PlacesSearchResult> {
  const byId = new Map<string, PlaceResult & { city: string }>();
  const errors: string[] = [];
  let calls = 0;

  for (const city of cities) {
    for (const term of TERMS) {
      if (calls >= MAX_CALLS_PER_RUN) {
        errors.push(`הופסק בתקרת ${MAX_CALLS_PER_RUN} קריאות לריצה`);
        return { results: [...byId.values()], calls, errors };
      }
      calls++;
      try {
        const found = await searchOnce(`${term} ${city}`);
        for (const p of found) {
          if (!p.operational) continue;
          // התוצאה הראשונה שנמצאה עבור place_id היא הקובעת - העיר שבה
          // חיפשנו היא הקישור שלנו לאזור.
          if (!byId.has(p.placeId)) byId.set(p.placeId, { ...p, city });
        }
      } catch (e) {
        errors.push(`${city}/${term}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  return { results: [...byId.values()], calls, errors };
}
