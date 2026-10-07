import { describe, it, expect } from "vitest";
import {
  addDays,
  campaignAudience,
  campaignScope,
  cplVerdict,
  diagnoseCampaign,
  isGenericGeoTerm,
  lastSeekerDay,
  netSupplyChanges,
  poissonCdf,
  psychologistShare,
  shrunkRate,
  sumFunnel,
  supplyFit,
  type CampaignProfile,
  type DiagnosisInput,
  type FunnelDay,
  type SupplyTherapist,
} from "./ads-diagnosis";

// All names here are invented. The repository is public.

const TODAY = "2026-10-07";

function day(d: string, patch: Partial<FunnelDay> = {}): FunnelDay {
  return { d, s: 0, c: 0, qs: 0, qd: 0, r: 0, pv: 0, k: 0, cl: 0, ...patch };
}

/** `n` consecutive days ending at `to`, each built by `make`. */
function span(to: string, n: number, make: (i: number) => Partial<FunnelDay>): FunnelDay[] {
  return Array.from({ length: n }, (_, i) => day(addDays(to, -(n - 1 - i)), make(i)));
}

function therapist(id: string, patch: Partial<SupplyTherapist> = {}): SupplyTherapist {
  return {
    id,
    name: `מטפל ${id}`,
    promoted: false,
    psychologist: false,
    female: true,
    adults: true,
    kids: false,
    online: false,
    regions: ["חדרה"],
    areas: ["טיפול דינאמי"],
    promotedUntil: null,
    ...patch,
  };
}

const NORTH_SHARON: CampaignProfile = {
  landing: [{ page: "region:צפון השרון", n: 68 }, { page: "about", n: 2 }],
  regions: [{ region: "צפון השרון", n: 16 }],
  searches: { n: 19, noPlace: 6 },
  quizTypes: { adults: 24, kids: 2 },
  treatmentSessions: 20,
  treatments: [{ t: "CBT", n: 16 }, { t: "טיפול דינאמי", n: 14 }, { t: "EMDR", n: 5 }],
};

describe("the statistics", () => {
  it("gives the chance of this few seekers or fewer", () => {
    expect(poissonCdf(0, 3)).toBeCloseTo(Math.exp(-3), 10);
    expect(poissonCdf(1, 3.9)).toBeCloseTo(Math.exp(-3.9) * 4.9, 10);
    expect(poissonCdf(4, 0)).toBe(1);
    expect(poissonCdf(50, 2)).toBeCloseTo(1, 6);
  });

  it("does not take a small sample at its word", () => {
    // 3 seekers from 20 sessions is not a 15% campaign.
    expect(shrunkRate(3, 20, 0.06)).toBeCloseTo((3 + 1.8) / 50, 10);
    // None from 20 is not a 0% campaign either.
    expect(shrunkRate(0, 20, 0.06)).toBeCloseTo(1.8 / 50, 10);
    // A long record speaks for itself.
    expect(shrunkRate(60, 1000, 0.2)).toBeCloseTo(66 / 1030, 10);
  });

  it("tells an expensive month from an unlucky one", () => {
    // ₪713 for 10 seekers against a ₪65 target: above it, and well within luck.
    const haifa = cplVerdict(713, 10, 65);
    expect(haifa.above).toBe(true);
    expect(haifa.p).toBeGreaterThan(0.3);
    // ₪254 for one seeker: the money should have bought about four.
    const emek = cplVerdict(254, 1, 65);
    expect(emek.expected).toBeCloseTo(3.9, 1);
    expect(emek.p).toBeLessThan(0.1);
    // Under the target there is nothing to flag.
    expect(cplVerdict(381, 12, 65).above).toBe(false);
  });
});

describe("the funnel", () => {
  const days = [
    day("2026-09-01", { s: 4, c: 3, qs: 2, qd: 1, r: 1, k: 1, cl: 3 }),
    day("2026-09-02", { s: 5, c: 4, qs: 2, qd: 2, r: 1 }),
    day("2026-09-03", { s: 2, c: 1 }),
  ];

  it("sums a window with both ends included", () => {
    expect(sumFunnel(days, "2026-09-01", "2026-09-02")).toMatchObject({ sessions: 9, sawCards: 7, quizDone: 3, seekers: 1, contactClicks: 3 });
    expect(sumFunnel(days, "2026-09-03", "2026-09-30").sessions).toBe(2);
  });

  it("finds the last day someone made contact", () => {
    expect(lastSeekerDay(days)).toBe("2026-09-01");
    expect(lastSeekerDay(days.slice(1))).toBeNull();
  });
});

describe("who a campaign serves", () => {
  it("is the region its visitors ask for in the quiz", () => {
    expect(campaignScope(NORTH_SHARON)).toEqual({ kind: "region", region: "צפון השרון" });
  });

  it("falls back to the page the ads land on, a city counting for its region", () => {
    const scattered: CampaignProfile = {
      ...NORTH_SHARON,
      landing: [{ page: "city_topic:תל אביב:פסיכולוג-ילדים-ונוער", n: 69 }, { page: "research:choosing-therapist", n: 5 }],
      regions: [{ region: "גוש דן", n: 3 }, { region: "צפון השרון", n: 2 }, { region: "דרום", n: 1 }, { region: "ירושלים והסביבה", n: 1 }],
    };
    expect(campaignScope(scattered)).toEqual({ kind: "region", region: "גוש דן" });
    // Several city pages of one region add up.
    const cities: CampaignProfile = {
      ...NORTH_SHARON,
      regions: [],
      landing: [{ page: "city:רחובות", n: 20 }, { page: "city:ראשון לציון", n: 8 }, { page: "city:גדרה", n: 2 }],
    };
    expect(campaignScope(cities)).toEqual({ kind: "region", region: "השפלה והמרכז" });
  });

  it("is online when the ads land on the online page, whatever the visitors type", () => {
    const online: CampaignProfile = {
      ...NORTH_SHARON,
      landing: [{ page: "region:online", n: 126 }, { page: "directory", n: 3 }],
      regions: [{ region: "גוש דן", n: 8 }, { region: "דרום", n: 2 }],
    };
    expect(campaignScope(online)).toEqual({ kind: "online" });
  });

  it("is unknown rather than guessed", () => {
    expect(campaignScope(null)).toEqual({ kind: "unknown" });
    expect(campaignScope({ ...NORTH_SHARON, regions: [], landing: [{ page: "home", n: 9 }] })).toEqual({ kind: "unknown" });
  });

  it("is adults or children by which quiz its visitors finish", () => {
    expect(campaignAudience(NORTH_SHARON)).toBe("adults");
    expect(campaignAudience({ ...NORTH_SHARON, quizTypes: { kids: 24 } })).toBe("kids");
    expect(campaignAudience({ ...NORTH_SHARON, quizTypes: { kids: 9, adults: 16 } })).toBe("mixed");
    // Too few quizzes to say: the landing page decides.
    expect(campaignAudience({ ...NORTH_SHARON, quizTypes: {}, landing: [{ page: "city_topic:תל אביב:פסיכולוג-ילדים-ונוער", n: 9 }] })).toBe("kids");
  });
});

// Five promoted therapists for adults, one of them a psychologist and a man;
// ten free psychologists who are hidden from a paid visitor.
function northSharonSupply(): SupplyTherapist[] {
  return [
    therapist("p1", { promoted: true, areas: ["CBT", "EMDR", "טיפול דינאמי"] }),
    therapist("p2", { promoted: true }),
    therapist("p3", { promoted: true }),
    therapist("p4", { promoted: true }),
    therapist("p5", { promoted: true, psychologist: true, female: false, areas: ["CBT", "טיפול דינאמי"] }),
    // A promoted child psychologist in the region is not supply for an adults campaign.
    therapist("p6", { promoted: true, psychologist: true, adults: false, kids: true, regions: ["נתניה"] }),
    ...Array.from({ length: 10 }, (_, i) =>
      therapist(`f${i}`, { psychologist: true, areas: i < 6 ? ["CBT", "טיפול דינאמי"] : ["טיפול דינאמי"] })
    ),
    ...Array.from({ length: 15 }, (_, i) => therapist(`o${i}`, { areas: i < 8 ? ["CBT"] : ["טיפול דינאמי"] })),
    // Another region entirely.
    therapist("x1", { promoted: true, psychologist: true, regions: ["ירושלים"] }),
  ];
}

const PSYCH_KEYWORDS = [
  { keyword: "פסיכולוג חדרה", cost: 90 },
  { keyword: "פסיכולוגית פרדס חנה", cost: 70 },
  { keyword: "טיפול פסיכולוגי בחדרה", cost: 62 },
  { keyword: "טיפול רגשי בחדרה", cost: 21 },
  { keyword: "מטפל רגשי פרדס חנה", cost: 10 },
];

describe("what the campaign buys against what a paid visitor is shown", () => {
  it("weighs the keywords by what was spent on them", () => {
    expect(psychologistShare(PSYCH_KEYWORDS)).toBeCloseTo(222 / 253, 10);
    // Too little spend to say anything.
    expect(psychologistShare([{ keyword: "פסיכולוג חדרה", cost: 12 }])).toBeNull();
  });

  it("counts the region's therapists for the campaign's audience", () => {
    const fit = supplyFit({
      scope: { kind: "region", region: "צפון השרון" },
      audience: "adults",
      profile: NORTH_SHARON,
      keywords: PSYCH_KEYWORDS,
      supply: northSharonSupply(),
    })!;
    expect(fit).toMatchObject({ promoted: 5, free: 25, promotedPsych: 1, promotedPsychFemale: 0, freePsych: 10 });
    // CBT went to 80% of the quiz finishers; two promoted therapists offer it.
    expect(fit.treatments[0]).toMatchObject({ t: "CBT", promoted: 2, free: 14 });
    expect(fit.treatments[0].share).toBeCloseTo(0.8, 10);
    expect(fit.gaps).toEqual(["profession", "treatment"]);
  });

  it("names the free therapists who close the gap, a psychologist with the treatment first", () => {
    const fit = supplyFit({
      scope: { kind: "region", region: "צפון השרון" },
      audience: "adults",
      profile: NORTH_SHARON,
      keywords: PSYCH_KEYWORDS,
      supply: northSharonSupply(),
    })!;
    // Six psychologists who offer CBT, then four who do not, then eight
    // other therapists who do. Seven free ones answer neither and are left out.
    expect(fit.candidates).toHaveLength(18);
    expect(fit.candidates.slice(0, 6).map((c) => c.id).sort()).toEqual(["f0", "f1", "f2", "f3", "f4", "f5"]);
    expect(fit.candidates.slice(6, 10).map((c) => c.id).sort()).toEqual(["f6", "f7", "f8", "f9"]);
    expect(fit.candidates.slice(10).every((c) => c.id.startsWith("o"))).toBe(true);
  });

  it("says when promoted supply is about to run out", () => {
    const supply = northSharonSupply().map((t) =>
      t.id === "p2" ? { ...t, promotedUntil: "2026-10-19" } : t.id === "p3" ? { ...t, promotedUntil: "2026-10-27" } : t.id === "p4" ? { ...t, promotedUntil: "2026-12-01" } : t
    );
    const fit = supplyFit({ scope: { kind: "region", region: "צפון השרון" }, audience: "adults", profile: NORTH_SHARON, keywords: PSYCH_KEYWORDS, supply, today: TODAY })!;
    // Two within three weeks; the one in December is not "soon".
    expect(fit.expiring).toEqual({ n: 2, until: "2026-10-19" });
    // Without a date to count from, nothing is claimed.
    expect(supplyFit({ scope: { kind: "region", region: "צפון השרון" }, audience: "adults", profile: NORTH_SHARON, keywords: PSYCH_KEYWORDS, supply })!.expiring).toBeNull();
  });

  it("has nothing to say when the region is not known", () => {
    expect(supplyFit({ scope: { kind: "unknown" }, audience: "adults", profile: null, keywords: [], supply: northSharonSupply() })).toBeNull();
  });

  it("finds no gap where the supply answers the demand", () => {
    const supply = [
      ...Array.from({ length: 6 }, (_, i) => therapist(`p${i}`, { promoted: true, psychologist: i < 4, areas: ["CBT", "טיפול דינאמי"] })),
    ];
    const fit = supplyFit({ scope: { kind: "region", region: "צפון השרון" }, audience: "adults", profile: NORTH_SHARON, keywords: PSYCH_KEYWORDS, supply })!;
    expect(fit.gaps).toEqual([]);
    expect(fit.candidates).toEqual([]);
  });
});

// g-north-sharon as it stood on 7/10/2026: 23 days of contacts, then 22 days
// with the same traffic and nobody contacting anyone.
function northSharonInput(patch: Partial<DiagnosisInput> = {}): DiagnosisInput {
  const dryDays = 22;
  const lastContact = addDays(TODAY, -dryDays);
  const before = span(lastContact, 23, (i) => ({ s: 3, c: 2, qs: 2, qd: 1, r: 1, k: (22 - i) % 3 === 0 ? 1 : 0, cl: (22 - i) % 3 === 0 ? 2 : 0 }));
  const dry = span(TODAY, dryDays, (i) => ({ s: i % 2 === 0 ? 3 : 2, c: 2, qs: 1, qd: 1, r: 1 }));
  const days = [...before, ...dry];
  return {
    googleName: "g-north-sharon1",
    utm: "g-north-sharon",
    today: TODAY,
    days,
    google: days.map((d) => ({ date: d.d, clicks: 2, cost: 11 })),
    accountRate: 0.065,
    profile: NORTH_SHARON,
    keywords: PSYCH_KEYWORDS,
    supply: northSharonSupply(),
    supplyChanges: [
      { date: addDays(TODAY, -8), therapistId: "f0", kind: "demoted" },
      { date: addDays(TODAY, -6), therapistId: "f1", kind: "demoted" },
      // A change in another region does not belong in this campaign's story.
      { date: addDays(TODAY, -5), therapistId: "x1", kind: "demoted" },
    ],
    siteChanges: [{ date: addDays(TODAY, -21), label: "מבקר ממומן רואה רק מטפלים מקודמים" }],
    landingRevised: null,
    pendingGiftOffers: [
      { regionLabel: "השרון", treatment: "CBT", candidates: [{ id: "f2", name: "דנה לוי" }, { id: "zz", name: "מישהו מדרום השרון" }] },
      { regionLabel: "ירושלים והסביבה", treatment: "CBT", candidates: [{ id: "f3", name: "לא רלוונטי" }] },
    ],
    ...patch,
  };
}

describe("the diagnosis of a campaign that spends and brings nobody", () => {
  it("calls a promoted supply that does not match the searches by its name", () => {
    const d = diagnoseCampaign(northSharonInput());
    expect(d.cause).toBe("supply");
    expect(d.confidence).toBe("high");
    expect(d.tag).toBe("כנראה היצע");
    expect(d.chance).toBe("unlikely");
    expect(d.stage).toBe("contact");
    expect(d.dry.seekers).toBe(0);
    expect(d.dry.sessions).toBe(55);
    expect(d.baseline.seekers).toBe(8);
    expect(d.baseline.sessions).toBe(69);
    // (8 + 30 x 0.065) / (69 + 30) per session, over 55 sessions.
    expect(d.expected).toBeCloseTo(55 * (9.95 / 99), 6);
    expect(d.pZero).toBeLessThan(0.01);
  });

  it("writes every claim from the numbers it was given", () => {
    const d = diagnoseCampaign(northSharonInput());
    expect(d.text).toContain("לא מקרי: 0 פונים מ-55 סשנים");
    expect(d.text).toContain("8 פונים מ-69 סשנים");
    expect(d.text).toContain("44 קליקים ← 55 סשנים ← 44 ראו כרטיסים ← 22 סיימו שאלון ← 0 פנו");
    expect(d.text).toContain('88% מהוצאת מילות המפתח על "פסיכולוג"');
    expect(d.text).toContain("מקודמים למבוגרים בצפון השרון: 5, מהם פסיכולוגים 1 (נשים: 0)");
    expect(d.text).toContain("חינמיים, שמוסתרים ממנו: 25, מהם פסיכולוגים 10");
    expect(d.text).toContain("CBT הומלץ ל-80% ממסיימי השאלון: 2 מקודמים, 14 חינמיים");
    // Dynamic therapy went to 70% and five promoted therapists offer it: no shortfall, no line.
    expect(d.text).not.toContain("טיפול דינאמי הומלץ");
    expect(d.text).toContain("ירדו 2 מקודמים באזור (29/9, 1/10)");
    expect(d.text).toContain("מבקר ממומן רואה רק מטפלים מקודמים");
  });

  it("points at the gift offers already waiting, for this region's therapists only", () => {
    const d = diagnoseCampaign(northSharonInput());
    expect(d.steps[0]).toContain('"CBT" (דנה לוי)');
    expect(d.steps[0]).not.toContain("מישהו מדרום השרון");
    expect(d.steps[0]).not.toContain("לא רלוונטי");
    expect(d.steps[1]).toContain("לצמצם את התקציב או להשהות");
    // Seven full days at ₪11.
    expect(d.steps[1]).toContain("₪77");
    expect(d.steps[1]).toContain("השינוי בגוגל נעשה על ידך");
  });

  it("leaves out a waiting offer that does not answer the gap", () => {
    const d = diagnoseCampaign(northSharonInput({
      pendingGiftOffers: [
        // o9 is a free therapist of the region who is neither a psychologist nor offers CBT.
        { regionLabel: "השרון", treatment: "טיפול בהבעה ויצירה", candidates: [{ id: "o9", name: "מטפלת באמנות" }] },
        { regionLabel: "השרון", treatment: "EMDR", candidates: [{ id: "f8", name: "פסיכולוגית בלי CBT" }] },
      ],
    }));
    expect(d.steps[0]).toContain('"EMDR" (פסיכולוגית בלי CBT)');
    expect(d.steps[0]).not.toContain("מטפלת באמנות");
  });

  it("does not count a therapist who left and came back as a change", () => {
    const d = diagnoseCampaign(northSharonInput({
      supplyChanges: [
        { date: addDays(TODAY, -8), therapistId: "f0", kind: "demoted" },
        // A centre archived and restored on the same day.
        { date: addDays(TODAY, -2), therapistId: "p2", kind: "demoted" },
        { date: addDays(TODAY, -2), therapistId: "p2", kind: "promoted" },
        { date: addDays(TODAY, -2), therapistId: "p3", kind: "demoted" },
        { date: addDays(TODAY, -2), therapistId: "p3", kind: "promoted" },
      ],
    }));
    expect(d.text).toContain("ירד מקודם אחד באזור (29/9)");
    expect(d.text).not.toContain("נוספו");
    expect(netSupplyChanges([
      { date: "2026-10-01", therapistId: "a", kind: "demoted" },
      { date: "2026-10-03", therapistId: "a", kind: "promoted" },
      { date: "2026-10-05", therapistId: "a", kind: "demoted" },
      { date: "2026-10-02", therapistId: "b", kind: "promoted" },
    ])).toEqual([
      { date: "2026-10-02", therapistId: "b", kind: "promoted" },
      { date: "2026-10-05", therapistId: "a", kind: "demoted" },
    ]);
  });

  it("warns when the promoted supply is about to shrink further", () => {
    const supply = northSharonSupply().map((t) => (t.id === "p2" ? { ...t, promotedUntil: "2026-10-19" } : t));
    const d = diagnoseCampaign(northSharonInput({ supply }));
    expect(d.text).toContain("בקרוב פחות: מקודם אחד מסיים תקופת ניסיון או מתנה, הראשון ב-19/10");
  });

  it("names candidates itself when no offer is waiting", () => {
    const d = diagnoseCampaign(northSharonInput({ pendingGiftOffers: [] }));
    expect(d.steps[0]).toContain("מועמדים חינמיים שסוגרים את הפער");
    expect(d.steps[0]).toContain("מטפל f0");
  });

  it("says a short dry spell on a small campaign may be luck, and how long to wait", () => {
    // Four seekers from 100 sessions, the last of them six days ago, then 12 sessions without one.
    const before = span(addDays(TODAY, -6), 50, (i) => ({ s: 2, c: 1, qs: 1, qd: 1, k: (49 - i) % 13 === 0 ? 1 : 0 }));
    const dry = span(TODAY, 6, () => ({ s: 2, c: 2, qs: 1, qd: 1 }));
    const days = [...before, ...dry];
    const d = diagnoseCampaign(northSharonInput({ days, google: days.map((x) => ({ date: x.d, clicks: 2, cost: 9 })) }));
    expect(d.chance).toBe("plausible");
    expect(d.cause).toBe("chance");
    expect(d.tag).toBe("בגבול המקריות");
    expect(d.text).toContain("ייתכן שמקרי");
    expect(d.steps[0]).toMatch(/אין מה לתקן עכשיו\. אם לא יגיע פונה בעוד כ-\d+ ימים/);
    // The supply table still appears, because it shows a gap.
    expect(d.text).toContain("מקודמים למבוגרים בצפון השרון");
  });

  it("treats clicks that never become tagged sessions as a measurement gap first", () => {
    const base = northSharonInput();
    const days = base.days.map((x) => (x.d > addDays(TODAY, -22) ? { ...x, s: 0, c: 0, qs: 0, qd: 0, r: 0 } : x));
    const d = diagnoseCampaign({ ...base, days });
    expect(d.stage).toBe("tracking");
    expect(d.cause).toBe("tracking");
    expect(d.confidence).toBe("high");
    expect(d.steps[0]).toContain("utm_campaign=g-north-sharon");
  });

  it("points at the landing page when visitors stop reaching the cards", () => {
    const base = northSharonInput();
    const days = base.days.map((x) => (x.d > addDays(TODAY, -22) ? { ...x, c: x.s === 3 ? 1 : 0 } : x));
    const d = diagnoseCampaign({ ...base, days, landingRevised: addDays(TODAY, -20) });
    expect(d.stage).toBe("landing");
    expect(d.cause).toBe("landing");
    expect(d.steps[0]).toContain("קוד דפי הנחיתה עודכן לאחרונה ב-17/9");
  });

  it("leans on the account when the campaign has never brought anyone", () => {
    const days = span(TODAY, 40, () => ({ s: 2, c: 2, qs: 1, qd: 1 }));
    const d = diagnoseCampaign(northSharonInput({ days, google: days.map((x) => ({ date: x.d, clicks: 2, cost: 9 })) }));
    expect(d.baseline.sessions).toBe(0);
    expect(d.rate).toBeCloseTo(0.065, 10);
    expect(d.expected).toBeCloseTo(80 * 0.065, 6);
    expect(d.text).toContain("ב-40 הימים שנבדקו");
    expect(d.text).toContain("לפי ממוצע החשבון");
  });

  it("does not invent a supply story for a campaign whose region it cannot tell", () => {
    const d = diagnoseCampaign(northSharonInput({ profile: null }));
    expect(d.fit).toBeNull();
    expect(d.cause).toBe("change");
    // Without a region, the therapists who changed status cannot be placed.
    expect(d.text).not.toContain("מקודמים באזור");
    const quiet = diagnoseCampaign(northSharonInput({ profile: null, siteChanges: [] }));
    expect(quiet.cause).toBe("unknown");
    expect(quiet.steps[0]).toContain("בגוגל אדס עצמו");
  });
});

describe("a generic search", () => {
  it("is one for a whole part of the country", () => {
    expect(isGenericGeoTerm("פסיכולוג בצפון")).toBe(true);
    expect(isGenericGeoTerm("פסיכולוגים צפון")).toBe(true);
    expect(isGenericGeoTerm("מטפלים בישראל")).toBe(true);
    expect(isGenericGeoTerm("פסיכולוג בגליל")).toBe(true);
    expect(isGenericGeoTerm("פסיכולוג באזור הצפון")).toBe(true);
  });

  it("is not a place that only carries the word", () => {
    expect(isGenericGeoTerm("פסיכולוגית צפון תל אביב")).toBe(false);
    expect(isGenericGeoTerm("פסיכולוג בצפון השרון")).toBe(false);
    expect(isGenericGeoTerm("מטפלים צפון השרון")).toBe(false);
    expect(isGenericGeoTerm("פסיכולוג חדרה")).toBe(false);
  });
});
