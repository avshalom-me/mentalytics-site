// The team behind the site, as /about presents them. One list for every page that
// shows the team (the about page and its JSON-LD, the counselors doorway), so a
// credential is written once. Bios are published here and nowhere else: a page
// that needs a shorter line picks from `bullets`, it does not restate them.

export type TeamMember = {
  name: string;
  role: string;
  img: string;
  bullets: string[];
};

export const team: TeamMember[] = [
  {
    name: 'ד"ר אבשלום גליל',
    role: 'מייסד ויו״ר החברה',
    img: "/team/avshalom.jpg",
    bullets: [
      "פסיכולוג קליני וחינוכי – מומחה מדריך",
      "דוקטורט בפסיכולוגיה קלינית ומדעי המוח (אוניברסיטת בר-אילן)",
      "מרצה וחוקר באוניברסיטת אריאל, במגמה הקלינית והתעסוקתית",
      "מרצה לאבחון והערכה במוסדות אקדמאיים",
    ],
  },
  {
    name: "גונן שש",
    role: "חבר הצוות המקצועי המפתח",
    img: "/team/gonen.jpg",
    bullets: ["פסיכולוג קליני מומחה", "מרצה בתחום האבחון הפסיכולוגי", "פסיכולוג מאבחן במגזר הפרטי והציבורי"],
  },
  {
    name: "שילת יוגב",
    role: "חברת הצוות המקצועי המפתח",
    img: "/team/shilat.jpeg",
    bullets: ["מנהלת מרכז טיפולי לילדים ומבוגרים במשך כעשור", "פיזיותרפיסטית ילדים"],
  },
  {
    name: "יוחאי ברוקנר",
    role: "חבר הצוות המקצועי המפתח",
    img: "/team/yochai.jpg",
    bullets: [
      "פסיכולוג בהתמחות חינוכית ותעסוקתית",
      "בעל ניסיון בתחום היזמות החברתית",
    ],
  },
  {
    name: "עומר סבו",
    role: "רכזת פיתוח ומחקר",
    img: "/team/omer.jpeg",
    bullets: [
      "סטודנטית לתואר שני בפסיכולוגיה התפתחותית",
      "ניסיון בעולמות הסטארטאפ ויזמות חברתית",
      "היכרות מעמיקה עם עולם הטיפול",
    ],
  },
];
