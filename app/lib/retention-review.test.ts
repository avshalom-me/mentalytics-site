import { describe, expect, it } from "vitest";
import {
  EMPTY_FUNNEL,
  benchmarkFrom,
  buildRetentionEmail,
  buildRetentionReview,
  emailBodyProblem,
  excludedFromReview,
  regionsOf,
  reviewWeekStart,
  tierOf,
  todoSentence,
  type FunnelRow,
  type ReviewContext,
  type TherapistInput,
} from "./retention-review";

const NOW = new Date("2026-10-11T05:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();
const daysAhead = (n: number) => new Date(NOW.getTime() + n * 86_400_000).toISOString();

function therapist(over: Partial<TherapistInput> = {}): TherapistInput {
  return {
    id: over.id ?? "t1",
    name: "דנה כהן",
    status: "paying",
    promotion_source: "paid",
    entity_type: null,
    center_account_id: null,
    promoted_since: daysAgo(60),
    promoted_until: null,
    created_at: daysAgo(90),
    admin_approved: true,
    accepting_new_patients: true,
    online: true,
    cities: ["תל אביב"],
    training_areas: ["CBT", "טיפול דינאמי", "חרדה", "דיכאון"],
    age_groups: ["מבוגרים", "צעירים"],
    bio: "א".repeat(200),
    profile_photo_path: "photo.jpg",
    education: "תואר שני בפסיכולוגיה קלינית",
    experience: "עשר שנות ניסיון בקליניקה",
    phone: "054-1234567",
    email: "x@example.com",
    match_paused_until: null,
    subscription: { first_charge_on: null, promo_reverts_at: null },
    guarantee: null,
    funnel: { ...EMPTY_FUNNEL, cards_cur: 50, cards_prev: 48, opens_cur: 10, opens_prev: 9, people_cur: 4, people_prev: 4, people_21: 3, people_14: 2, last_contact_at: daysAgo(3), first_card_at: daysAgo(59) },
    lastOutreachAt: null,
    ...over,
  };
}

function ctx(over: Partial<ReviewContext> = {}): ReviewContext {
  return {
    now: NOW,
    windowDays: 30,
    benchmark: { peers: 13, cards: 50, opens: 10, people: 3, avgScore: 84 },
    regionBenchmarks: {},
    demand: { "גוש דן": { searches: 300, online: 90, treatmentSessions: 100, treatments: [{ t: "CBT", n: 60 }, { t: "טיפול דינאמי", n: 40 }] } },
    demandTotal: 500,
    onlineShare: 0.3,
    holidayWeek: null,
    emailCooldownDays: 21,
    ...over,
  };
}

const funnel = (over: Partial<FunnelRow>): FunnelRow => ({ ...EMPTY_FUNNEL, ...over });

describe("tierOf", () => {
  it("paid and gift_trial are the money group; trial and manual are the gift group, even when the trial is ending", () => {
    expect(tierOf({ status: "paying", promotion_source: "paid", entity_type: null })).toBe("high");
    expect(tierOf({ status: "paying", promotion_source: "gift_trial", entity_type: null })).toBe("high");
    expect(tierOf({ status: "paying", promotion_source: "manual", entity_type: null })).toBe("medium");
    expect(tierOf({ status: "paying", promotion_source: "trial", entity_type: null })).toBe("medium");
  });
  it("centers are their own group, and a free therapist is not in the review", () => {
    expect(tierOf({ status: "paying", promotion_source: "center", entity_type: null })).toBe("center");
    expect(tierOf({ status: "approved", promotion_source: null, entity_type: null })).toBeNull();
  });
  it("a suspended or unapproved therapist is left out of the review and counted, not flagged", () => {
    expect(excludedFromReview({ accepting_new_patients: false, admin_approved: true })).toBe("suspended");
    expect(excludedFromReview({ accepting_new_patients: true, admin_approved: false })).toBe("unapproved");
    expect(excludedFromReview({ accepting_new_patients: true, admin_approved: true })).toBeNull();
    const { rows, summary } = buildRetentionReview([therapist({ accepting_new_patients: false }), therapist({ id: "u", admin_approved: false })], ctx());
    expect(rows).toEqual([]);
    expect(summary.excluded).toEqual({ suspended: 1, unapproved: 1 });
    expect(summary.checked).toBe(0);
  });
});

describe("risk", () => {
  it("a paying therapist with contacts and normal exposure is ok", () => {
    const { rows } = buildRetentionReview([therapist()], ctx());
    expect(rows[0].risk).toBe("ok");
    expect(rows[0].tier).toBe("high");
    expect(rows[0].actions).toEqual([]);
  });

  it("no contact in 21 days is medium; a closing guarantee window makes it high", () => {
    const quiet = therapist({ funnel: funnel({ cards_cur: 40, opens_cur: 8, people_21: 0, people_cur: 0, people_prev: 1, last_contact_at: daysAgo(25), first_card_at: daysAgo(59) }) });
    expect(buildRetentionReview([quiet], ctx()).rows[0].risk).toBe("medium");
    const guaranteed = therapist({ ...quiet, guarantee: { daysLeft: 10, contacts: 0 } });
    const row = buildRetentionReview([guaranteed], ctx()).rows[0];
    expect(row.risk).toBe("high");
    const flag = row.flags.find((f) => f.key === "guarantee_closing");
    expect(flag?.label).toBe("ערבות הפניות נסגרת בעוד 10 ימים");
    expect(row.actions.map((a) => a.type)).toContain("task");
    expect(row.todo).toContain("להתקשר לפני המועד (ערבות הפניות נסגרת בעוד 10 ימים)");
  });

  it("a trial ending without contacts stays in the gift group, is high, and offers an extension", () => {
    const t = therapist({ promotion_source: "trial", promoted_until: daysAhead(9), funnel: funnel({ cards_cur: 40, opens_cur: 8, people_21: 0, last_contact_at: daysAgo(25), first_card_at: daysAgo(59) }) });
    const row = buildRetentionReview([t], ctx()).rows[0];
    expect(row.tier).toBe("medium");
    expect(row.risk).toBe("high");
    expect(row.flags.find((f) => f.key === "trial_ending")?.label).toMatch(/^הניסיון מסתיים ב-/);
    expect(row.actions.map((a) => a.type)).toContain("extend");
    expect(row.actions.map((a) => a.type)).not.toContain("task"); // שיחה רק למי שמשלם או עומד לשלם
    expect(row.todo).toContain("להאריך את הניסיון");
  });

  it("low exposure with enough contacts is fine; low exposure with one contact is medium", () => {
    const low = funnel({ cards_cur: 10, opens_cur: 3, people_21: 2, people_cur: 2, people_prev: 2, last_contact_at: daysAgo(2), first_card_at: daysAgo(59) });
    expect(buildRetentionReview([therapist({ funnel: low })], ctx()).rows[0].risk).toBe("ok");
    const lowOne = funnel({ ...low, people_21: 1, people_cur: 1 });
    const row = buildRetentionReview([therapist({ funnel: lowOne })], ctx()).rows[0];
    expect(row.risk).toBe("medium");
    expect(row.flags.map((f) => f.key)).toContain("low_exposure");
  });

  it("measures a therapist against the regional benchmark when the region has peers", () => {
    const low = funnel({ cards_cur: 10, opens_cur: 3, people_21: 0, people_cur: 0, first_card_at: daysAgo(59) });
    const c = ctx({ regionBenchmarks: { "גוש דן": { peers: 4, cards: 20, opens: 4, people: 2, avgScore: 84 } } });
    const row = buildRetentionReview([therapist({ funnel: low })], c).rows[0];
    expect(row.metrics.cardsBenchmark).toBe(20);
    expect(row.metrics.benchmarkScope).toBe("region");
    // 10 is half of 20 - above the 40% line, so no low-exposure flag even though the all-peer benchmark is 50.
    expect(row.flags.map((f) => f.key)).not.toContain("low_exposure");
  });

  it("a paying therapist nobody can reach (no city, not online) is critical, with a fix action", () => {
    const row = buildRetentionReview([therapist({ cities: [], online: false })], ctx()).rows[0];
    expect(row.risk).toBe("critical");
    expect(row.flags[0].key).toBe("no_reach");
    expect(row.actions[0].type).toBe("fix");
    expect(row.actions[0].link).toContain(row.therapist_id);
    expect(row.todo).toMatch(/^לתקן באדמין/);
  });

  it("an invalid phone with no email is critical; a landline only loses WhatsApp", () => {
    const bad = buildRetentionReview([therapist({ phone: "me@example.com", email: null })], ctx()).rows[0];
    expect(bad.risk).toBe("critical");
    expect(bad.flags.find((f) => f.key === "contact_buttons")?.severity).toBe("critical");
    const landline = buildRetentionReview([therapist({ phone: "03-5551234" })], ctx()).rows[0];
    expect(landline.flags.map((f) => f.key)).toContain("landline");
    expect(landline.risk).toBe("ok");
  });

  it("a new therapist gets an onboarding checklist, not a risk score", () => {
    const fresh = therapist({ promoted_since: daysAgo(5), funnel: funnel({}), profile_photo_path: null });
    const row = buildRetentionReview([fresh], ctx()).rows[0];
    expect(row.risk).toBe("new");
    expect(row.flags.map((f) => f.key)).toContain("gap_photo");
    expect(row.actions.map((a) => a.type)).toEqual(["email"]);
  });

  it("a new therapist with no card appearance after a week is critical - that is on us", () => {
    const fresh = therapist({ promoted_since: daysAgo(9), funnel: funnel({}) });
    const row = buildRetentionReview([fresh], ctx()).rows[0];
    expect(row.risk).toBe("critical");
    expect(row.flags[0].key).toBe("no_first_card");
  });

  it("a frozen therapist is reported as paused, not at risk", () => {
    const row = buildRetentionReview([therapist({ match_paused_until: daysAhead(5), funnel: funnel({ people_21: 0 }) })], ctx()).rows[0];
    expect(row.risk).toBe("paused");
  });

  it("a sharp drop in people escalates to high", () => {
    const row = buildRetentionReview([therapist({ funnel: funnel({ cards_cur: 50, opens_cur: 10, people_prev: 6, people_cur: 1, people_21: 0, last_contact_at: daysAgo(24), first_card_at: daysAgo(59) }) })], ctx()).rows[0];
    expect(row.risk).toBe("high");
    expect(row.flags.map((f) => f.key)).toContain("drop");
  });
});

describe("diagnosis flags", () => {
  it("notes the treatment the region's quizzes recommend that the profile lacks - for us, never as a suggestion to the therapist", () => {
    const row = buildRetentionReview([therapist({ training_areas: ["טיפול דינאמי", "חרדה", "דיכאון", "זוגיות"], funnel: funnel({ cards_cur: 30, opens_cur: 6, people_21: 0, first_card_at: daysAgo(59) }) })], ctx()).rows[0];
    const flag = row.flags.find((f) => f.key === "treatment_mismatch");
    expect(flag?.label).toBe("ביקוש ל-CBT באזור");
    expect(flag?.owner).toBe("us");
    expect(flag?.emailParagraph).toBeUndefined();
    const email = row.actions.find((a) => a.type === "email");
    expect(email?.body ?? "").not.toContain("CBT");
  });

  it("flags a card that is rarely opened and a profile that is opened but never contacted", () => {
    const notOpened = buildRetentionReview([therapist({ funnel: funnel({ cards_cur: 60, opens_cur: 2, people_21: 0, first_card_at: daysAgo(59) }) })], ctx()).rows[0];
    expect(notOpened.flags.map((f) => f.key)).toContain("card_not_opened");
    const notConverting = buildRetentionReview([therapist({ funnel: funnel({ cards_cur: 60, opens_cur: 20, people_21: 0, people_cur: 0, first_card_at: daysAgo(59) }) })], ctx()).rows[0];
    expect(notConverting.flags.map((f) => f.key)).toContain("profile_not_converting");
  });

  it("flags paid-traffic dependence and low demand in a region without online", () => {
    const c = ctx({ demand: { "עמק יזרעאל ונצרת": { searches: 12, online: 2, treatmentSessions: 5, treatments: [] } } });
    const row = buildRetentionReview([therapist({ online: false, cities: ["מגדל העמק"], funnel: funnel({ cards_cur: 25, paid_cards_cur: 22, opens_cur: 5, people_21: 0, first_card_at: daysAgo(59) }) })], c).rows[0];
    const keys = row.flags.map((f) => f.key);
    expect(keys).toContain("no_demand");
    expect(keys).toContain("paid_dependent");
    expect(keys).toContain("not_online");
    expect(row.actions.map((a) => a.type)).toContain("campaign");
  });

  it("finds the therapist who crowds a region and offers a silent freeze; the others are marked crowded out", () => {
    const strong = therapist({ id: "s", name: "חזק מאוד", promotion_source: "trial", promoted_until: daysAhead(40), funnel: funnel({ cards_cur: 90, opens_cur: 20, people_14: 6, people_21: 8, people_cur: 9, last_contact_at: daysAgo(1), first_card_at: daysAgo(59) }) });
    const weak = (id: string) => therapist({ id, name: `חלש ${id}`, funnel: funnel({ cards_cur: 15, opens_cur: 3, people_21: 0, first_card_at: daysAgo(59) }) });
    const { rows } = buildRetentionReview([strong, weak("a"), weak("b"), weak("c")], ctx());
    const s = rows.find((r) => r.therapist_id === "s")!;
    expect(s.flags.map((f) => f.key)).toContain("over_exposed");
    expect(s.actions[0].type).toBe("freeze");
    expect(s.actions[0].days).toBe(7);
    const a = rows.find((r) => r.therapist_id === "a")!;
    expect(a.flags.map((f) => f.key)).toContain("crowded_out");
    expect(a.flags.find((f) => f.key === "crowded_out")?.detail).toContain("חזק מאוד");
  });

  it("does not offer to freeze a gift_trial therapist, even when they crowd the region", () => {
    const strong = therapist({ id: "s", promotion_source: "gift_trial", funnel: funnel({ cards_cur: 90, opens_cur: 20, people_14: 6, people_21: 8, people_cur: 9, first_card_at: daysAgo(59) }) });
    const weak = (id: string) => therapist({ id, funnel: funnel({ cards_cur: 15, opens_cur: 3, people_21: 0, first_card_at: daysAgo(59) }) });
    const { rows } = buildRetentionReview([strong, weak("a"), weak("b"), weak("c")], ctx());
    expect(rows.find((r) => r.therapist_id === "s")!.actions.map((x) => x.type)).not.toContain("freeze");
  });
});

describe("the email draft", () => {
  it("is built only from the therapist's own flags, carries no performance number, and stops at three paragraphs", () => {
    const row = buildRetentionReview([therapist({ online: false, profile_photo_path: null, bio: "קצר", phone: "03-5551234", funnel: funnel({ cards_cur: 60, opens_cur: 2, people_21: 0, first_card_at: daysAgo(59) }) })], ctx()).rows[0];
    const email = row.actions.find((a) => a.type === "email")!;
    expect(email.subject).toBe("כמה הצעות לפרופיל שלך בטיפול חכם");
    expect(email.body).toContain("שלום דנה,");
    const bullets = (email.body ?? "").split("\n").filter((l) => l.startsWith("• "));
    expect(bullets).toHaveLength(3);
    // The only digits allowed are the general demand share (אונליין), never the therapist's counts.
    expect(email.body).not.toMatch(/60|2 כניסות|הופעות/);
    expect(email.body).not.toContain("—");
  });

  it("is withheld when there is nothing the therapist can do", () => {
    expect(buildRetentionEmail("דנה", [{ key: "low_exposure", severity: "normal", owner: "us", label: "x", detail: "y" }])).toBeNull();
  });

  it("marks the draft as cooled when an outreach email went out recently", () => {
    const row = buildRetentionReview([therapist({ online: false, lastOutreachAt: daysAgo(5), funnel: funnel({ cards_cur: 40, opens_cur: 8, people_21: 0, first_card_at: daysAgo(59) }) })], ctx()).rows[0];
    expect(row.actions.find((a) => a.type === "email")?.title).toContain("צינון");
  });

  it("center therapists get no email action - their outreach goes through the center", () => {
    const row = buildRetentionReview([therapist({ promotion_source: "center", center_account_id: "c1", online: false, funnel: funnel({ cards_cur: 40, opens_cur: 8, people_21: 0, first_card_at: daysAgo(59) }) })], ctx()).rows[0];
    expect(row.tier).toBe("center");
    expect(row.actions.map((a) => a.type)).not.toContain("email");
  });
});

describe("summary and ordering", () => {
  it("orders by tier then risk, and counts", () => {
    const { rows, summary } = buildRetentionReview(
      [
        therapist({ id: "m", promotion_source: "manual", funnel: funnel({ people_21: 0, cards_cur: 40, opens_cur: 8, first_card_at: daysAgo(59) }) }),
        therapist({ id: "p-ok" }),
        therapist({ id: "p-quiet", funnel: funnel({ people_21: 0, cards_cur: 40, opens_cur: 8, first_card_at: daysAgo(59) }) }),
      ],
      ctx(),
    );
    expect(rows.map((r) => r.therapist_id)).toEqual(["p-quiet", "p-ok", "m"]);
    expect(summary.byTier).toEqual({ high: 2, medium: 1, center: 0 });
    // Never contacted in 60 days of promotion = long silence, which is high, not medium.
    expect(summary.byRisk.high).toBe(2);
    expect(summary.byRisk.ok).toBe(1);
    expect(summary.checked).toBe(3);
  });
});

describe("the one-sentence todo", () => {
  it("leads with the most important action and names what the email asks for, at most three things", () => {
    const row = buildRetentionReview([therapist({ online: false, profile_photo_path: null, bio: "קצר", phone: "03-5551234", funnel: funnel({ cards_cur: 60, opens_cur: 2, people_21: 0, last_contact_at: daysAgo(25), first_card_at: daysAgo(59) }) })], ctx()).rows[0];
    // לפי חומרת הדגל: תמונה וביו (גבוהה) לפני הקו הנייח (רגילה).
    expect(row.todo).toBe("לשלוח מייל (תמונה, ביו, מספר נייד לוואטסאפ).");
  });
  it("combines two actions into one sentence", () => {
    expect(todoSentence(
      [{ type: "freeze", title: "x", detail: "y", days: 7 }, { type: "task", title: "x", detail: "y" }],
      [{ key: "guarantee_closing", severity: "high", owner: "us", label: "ערבות הפניות נסגרת בעוד 5 ימים", detail: "" }],
      "high",
    )).toBe("להקפיא ל-7 ימים (חזק/ה מדי באזור), ולהתקשר לפני המועד (ערבות הפניות נסגרת בעוד 5 ימים).");
  });
  it("says so when there is nothing to do, and that a frozen therapist is a decision", () => {
    expect(todoSentence([], [], "ok")).toBe("אין מה לעשות השבוע.");
    expect(todoSentence([], [], "new")).toBe("עוד מוקדם למדוד - לעקוב בשבוע הבא.");
    expect(todoSentence([], [], "paused")).toMatch(/^מוקפא/);
  });
});

describe("emailBodyProblem", () => {
  it("rejects performance numbers, an em dash and bad lengths, and accepts demand percentages and dates", () => {
    const ok = "שלום דנה,\n\nעברנו על הפרופיל שלך ויש כמה דברים שיכולים לעזור: כ-19% מהפונים מחפשים אונליין, וכדאי לוודא שכל התחומים מסומנים. ההצעה תקפה עד 22.10.2026.\n\nבברכה";
    expect(emailBodyProblem(ok)).toBeNull();
    expect(emailBodyProblem(ok.replace("כ-19%", "היו לך 47 הופעות"))).toMatch(/מספר/);
    expect(emailBodyProblem(ok + " — סוף")).toMatch(/מקף/);
    expect(emailBodyProblem("קצר")).toMatch(/קצרה/);
  });
});

describe("helpers", () => {
  it("maps cities to regions without duplicates", () => {
    expect(regionsOf(["תל אביב", "רמת גן", "עיר שלא קיימת"])).toEqual(["גוש דן"]);
  });
  it("averages the peers for the benchmark", () => {
    expect(benchmarkFrom([funnel({ cards_cur: 10, opens_cur: 2, people_cur: 1, avg_score_cur: 80 }), funnel({ cards_cur: 30, opens_cur: 4, people_cur: 3, avg_score_cur: 90 })]))
      .toEqual({ peers: 2, cards: 20, opens: 3, people: 2, avgScore: 85 });
    expect(benchmarkFrom([])).toBeNull();
  });
  it("the review week starts on the Israeli Sunday", () => {
    expect(reviewWeekStart(new Date("2026-10-11T05:00:00Z"))).toBe("2026-10-11"); // Sunday
    expect(reviewWeekStart(new Date("2026-10-14T20:00:00Z"))).toBe("2026-10-11"); // Wednesday night
    expect(reviewWeekStart(new Date("2026-10-17T22:30:00Z"))).toBe("2026-10-18"); // Saturday 22:30 UTC = Sunday 01:30 Israel
  });
});
