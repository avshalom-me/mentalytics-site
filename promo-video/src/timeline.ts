export const FPS = 30;

export type Speaker = 'standing' | 'sitting';

export type Item =
  | {kind: 'line'; speaker: Speaker; text: string; dur: number}
  | {kind: 'cutaway'; dur: number}
  | {kind: 'beat'; dur: number};

export const INTRO = 60;
export const OUTRO = 165;

export const ITEMS: Item[] = [
  {kind: 'line', speaker: 'standing', text: 'היי, מה המצב? מה אתה עושה?', dur: 75},
  {kind: 'line', speaker: 'sitting', text: 'אני בסדר. מחפש פסיכולוג, בא לי להתחיל טיפול.', dur: 95},
  {kind: 'line', speaker: 'standing', text: 'איך אתה מחפש?', dur: 60},
  {kind: 'line', speaker: 'sitting', text: 'לא יודע... עובר פה על תמונות.', dur: 75},
  {kind: 'line', speaker: 'standing', text: 'אבל מה אתה צריך בעצם?', dur: 70},
  {kind: 'line', speaker: 'sitting', text: 'אין לי מושג, האמת. אני לא מבין בזה — פשוט מעביר תמונות בגוגל ומחפש מישהו.', dur: 130},
  {kind: 'line', speaker: 'standing', text: 'תגיד, מה אתה, ילד? לא מחפשים ככה מטפלים היום. תיכנס לטיפול חכם.', dur: 125},
  {kind: 'line', speaker: 'sitting', text: 'טיפול חכם? מה זה אומר?', dur: 70},
  {kind: 'line', speaker: 'standing', text: 'זה שאלון שנבנה על ידי פסיכולוגים קליניים. הוא בודק קודם כל מה הבעיה שלך ואיזה טיפול אתה צריך — ואז מתאים לך רשימה של פסיכולוגים לפי האישיות שלך.', dur: 210},
  {kind: 'line', speaker: 'sitting', text: 'באמת? יש דבר כזה?', dur: 60},
  {kind: 'line', speaker: 'standing', text: 'כן, בהחלט! תסתכל:', dur: 60},
  {kind: 'cutaway', dur: 200},
  {kind: 'line', speaker: 'sitting', text: 'וואו, נראה מעניין. טוב, אני עונה על השאלון.', dur: 100},
  {kind: 'beat', dur: 55},
  {kind: 'line', speaker: 'sitting', text: 'טוב... יאללה, אתה צריך עוד משהו?', dur: 95},
];

export const starts = (() => {
  let t = INTRO;
  return ITEMS.map((it) => {
    const s = t;
    t += it.dur;
    return s;
  });
})();

export const DIALOGUE_END = INTRO + ITEMS.reduce((a, b) => a + b.dur, 0);
export const TOTAL = DIALOGUE_END + OUTRO;
