// הנפקת refresh token לתיבת admin@getmentalytics.com, בלי OAuth Playground.
//
// למה זה קיים: ב-Playground קוד ההרשאה חי כמה דקות, ההחלפה נעשית בלחיצה
// ידנית נפרדת, והסוד מוצג על המסך בגוף הבקשה. שלושת אלה הכשילו את
// ההנפקה פעמיים (invalid_grant) וגרמו לחשיפת סוד. כאן הקוד נתפס
// אוטומטית ומוחלף באותה שנייה, ושום סוד לא מוצג.
//
// הרצה:
//   node scripts/gmail-auth.mjs
//
// דורש שבקונסולה, תחת Authorized redirect URIs של הקליינט, יופיע:
//   http://localhost:5599/callback

import http from "node:http";
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

const PORT = 5599;
const REDIRECT = `http://localhost:${PORT}/callback`;
const EXPECTED = "admin@getmentalytics.com";
const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
].join(" ");

const rl = readline.createInterface({ input: stdin, output: stdout });
const clientId = (process.env.GMAIL_CLIENT_ID ?? (await rl.question("Client ID: "))).trim();
const clientSecret = (process.env.GMAIL_CLIENT_SECRET ?? (await rl.question("Client Secret: "))).trim();
rl.close();

if (!clientId || !clientSecret) {
  console.error("\nחסר Client ID או Secret. עצירה.");
  process.exit(1);
}

// state אקראי - הגנה סטנדרטית מזיוף הקריאה החוזרת.
const state = Math.random().toString(36).slice(2) + Date.now().toString(36);

const authUrl =
  "https://accounts.google.com/o/oauth2/v2/auth?" +
  new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT,
    response_type: "code",
    scope: SCOPES,
    // offline + consent = גוגל מחזירה refresh token, וגם בפעם השנייה.
    access_type: "offline",
    prompt: "consent",
    // מציע מראש את החשבון הנכון, כדי לצמצם את הטעות שכבר קרתה פעם.
    login_hint: EXPECTED,
    state,
  }).toString();

console.log("\n" + "─".repeat(70));
console.log("פתח את הכתובת הבאה בדפדפן (עדיף בחלון גלישה בסתר):\n");
console.log(authUrl);
console.log("\nהתחבר בתור " + EXPECTED + " ואשר את שתי ההרשאות.");
console.log("─".repeat(70) + "\n");
console.log("ממתין לאישור...");

function reply(res, status, html) {
  res.writeHead(status, { "Content-Type": "text/html; charset=utf-8" });
  res.end(`<!doctype html><html dir="rtl"><meta charset="utf-8">
    <body style="font-family:Heebo,Arial,sans-serif;padding:40px;line-height:1.7">${html}</body></html>`);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname !== "/callback") {
    res.writeHead(404).end();
    return;
  }

  const err = url.searchParams.get("error");
  if (err) {
    reply(res, 400, `<h2>האישור בוטל</h2><p>${err}</p>`);
    console.error(`\nהאישור נדחה: ${err}`);
    server.close();
    process.exit(1);
  }

  if (url.searchParams.get("state") !== state) {
    reply(res, 400, "<h2>state לא תואם</h2><p>הקריאה החוזרת אינה מהבקשה שיצאה מכאן.</p>");
    console.error("\nstate לא תואם - עצירה.");
    server.close();
    process.exit(1);
  }

  const code = url.searchParams.get("code");
  if (!code) {
    reply(res, 400, "<h2>לא התקבל קוד</h2>");
    server.close();
    process.exit(1);
  }

  try {
    // ההחלפה קורית מיד, באותה שנייה שהקוד נוצר - בלי מרוץ מול התפוגה.
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: REDIRECT,
        grant_type: "authorization_code",
      }),
    });
    const tok = await tokenRes.json();
    if (!tokenRes.ok || !tok.refresh_token) {
      const detail = tok.error_description || tok.error || `HTTP ${tokenRes.status}`;
      reply(res, 500, `<h2>ההחלפה נכשלה</h2><p>${detail}</p>`);
      console.error(`\nההחלפה נכשלה: ${detail}`);
      if (tok.error === "redirect_uri_mismatch") {
        console.error(`הוסף בקונסולה, תחת Authorized redirect URIs, בדיוק: ${REDIRECT}`);
      }
      server.close();
      process.exit(1);
    }

    // אימות זהות התיבה - אותה בדיקה שהסוכן עושה בכל ריצה.
    const profRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
      headers: { Authorization: `Bearer ${tok.access_token}` },
    });
    const prof = await profRes.json();
    const account = (prof.emailAddress ?? "").toLowerCase();

    if (account !== EXPECTED) {
      reply(
        res,
        400,
        `<h2>החשבון השגוי</h2><p>אושר <b>${account}</b> במקום <b>${EXPECTED}</b>.<br>
         הטוקן לא יוצג. בטל את ההרשאה ב-myaccount.google.com/permissions והרץ שוב.</p>`
      );
      console.error(`\n✗ אושר ${account} ולא ${EXPECTED}. הטוקן לא מוצג בכוונה.`);
      console.error("  בטל ב-myaccount.google.com/permissions והרץ שוב בחלון בסתר.");
      server.close();
      process.exit(1);
    }

    reply(
      res,
      200,
      `<h2>הצליח ✓</h2><p>הטוקן הונפק עבור <b>${account}</b>.<br>
       חזור לטרמינל - הערך מודפס שם. אפשר לסגור את החלון הזה.</p>`
    );

    console.log("\n" + "═".repeat(70));
    console.log(`✓ אומת: הטוקן שייך ל-${account}`);
    console.log("═".repeat(70));
    console.log("\nGMAIL_REFRESH_TOKEN=" + tok.refresh_token);
    console.log("\n" + "═".repeat(70));
    console.log("העתק את הערך ל-Vercel (Production), יחד עם GMAIL_CLIENT_ID");
    console.log("ו-GMAIL_CLIENT_SECRET, ואז Redeploy.");
    console.log("נקה את הטרמינל אחרי ההעתקה - הטוקן מוצג כאן בגלוי.");
    console.log("═".repeat(70) + "\n");

    server.close();
    process.exit(0);
  } catch (e) {
    reply(res, 500, `<h2>שגיאה</h2><p>${e.message}</p>`);
    console.error("\nשגיאה:", e.message);
    server.close();
    process.exit(1);
  }
});

server.listen(PORT);
