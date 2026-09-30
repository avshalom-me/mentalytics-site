// Israeli holidays that change how people search and click, so a week that
// contains one is not judged against an ordinary week. The budget agent did not
// know on its own that the week before 29/9/2026 was Sukkot.
//
// Dates from Hebcal (Israel schedule), fetched 30/9/2026. To extend a year:
// https://www.hebcal.com/hebcal?v=1&cfg=json&maj=on&mod=on&year=YYYY&month=x&i=on
// and copy the major holidays, whole weeks for Pesach and Sukkot.

export type Holiday = {
  name: string;
  /** First and last day, inclusive, YYYY-MM-DD. */
  from: string;
  to: string;
  /** School holiday rather than a day off - matters for the children's campaigns. */
  schoolOnly?: boolean;
};

export const ISRAEL_HOLIDAYS: Holiday[] = [
  { name: "פורים", from: "2026-03-03", to: "2026-03-03" },
  { name: "פסח", from: "2026-04-02", to: "2026-04-08" },
  { name: "יום הזיכרון ויום העצמאות", from: "2026-04-21", to: "2026-04-22" },
  { name: "שבועות", from: "2026-05-22", to: "2026-05-22" },
  { name: "תשעה באב", from: "2026-07-23", to: "2026-07-23" },
  { name: "ראש השנה", from: "2026-09-12", to: "2026-09-13" },
  { name: "יום כיפור", from: "2026-09-21", to: "2026-09-21" },
  { name: "סוכות ושמיני עצרת", from: "2026-09-26", to: "2026-10-03" },
  { name: "חנוכה", from: "2026-12-04", to: "2026-12-12", schoolOnly: true },
  { name: "פורים", from: "2027-03-23", to: "2027-03-23" },
  { name: "פסח", from: "2027-04-22", to: "2027-04-28" },
  { name: "יום הזיכרון ויום העצמאות", from: "2027-05-11", to: "2027-05-12" },
  { name: "שבועות", from: "2027-06-11", to: "2027-06-11" },
  { name: "תשעה באב", from: "2027-08-12", to: "2027-08-12" },
  { name: "ראש השנה", from: "2027-10-02", to: "2027-10-03" },
  { name: "יום כיפור", from: "2027-10-11", to: "2027-10-11" },
  { name: "סוכות ושמיני עצרת", from: "2027-10-16", to: "2027-10-23" },
  { name: "חנוכה", from: "2027-12-24", to: "2028-01-01", schoolOnly: true },
];

/** Holidays that touch the inclusive range [from, to]. */
export function holidaysBetween(from: string, to: string): Holiday[] {
  return ISRAEL_HOLIDAYS.filter((h) => h.to >= from && h.from <= to);
}

/** The last day the table covers; past it the report says the calendar needs extending. */
export const HOLIDAYS_KNOWN_UNTIL = ISRAEL_HOLIDAYS[ISRAEL_HOLIDAYS.length - 1].to;
