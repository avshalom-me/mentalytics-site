import type { NextRequest } from "next/server";

// זיהוי בוטים בנקודת הרישום של האנליטיקס.
//
// למה כאן ולא בסינון בדיעבד: הסורק שנמדד ב-8/8/2026 (462 צפיות פרופיל על 143
// מטפלים ביום אחד) לא שומר localStorage, ולכן כל עמוד שנסרק נרשם כסשן חדש עם
// צפייה אחת - אין שום חתימת "סשן כבד" שאפשר לסנן אחורה. מה שכן מזהה אותו ואת
// דומיו הוא ה-User-Agent, שקיים רק ברגע הבקשה ואינו נשמר בטבלאות. לכן הסינון
// חייב לקרות בזמן אמת, לפני ה-INSERT.
//
// הרשימה תופסת סורקים מוצהרים (Googlebot, GPTBot, ClaudeBot...), כלי HTTP
// (curl, python-requests...) ודפדפנים אוטומטיים (HeadlessChrome, Playwright).
// מי שמזייף UA של דפדפן אמיתי יעבור - זו לא הגנת אבטחה, זו הפרדת מדידה: את
// הרוב המוחלט של זיהום הנתונים מייצרים בוטים שדווקא מזדהים בשמם.
const BOT_UA_RE =
  /bot|crawl|spider|slurp|headless|lighthouse|prerender|phantomjs|puppeteer|playwright|selenium|python|curl\/|wget|scrapy|axios\/|okhttp|go-http|node-fetch|httpclient|semrush|ahrefs|mj12|bytespider|petalbot|baiduspider|sogou|facebookexternalhit|bingpreview|ia_archiver|perplexity|anthropic|claude-web|chatgpt|oai-searchbot|ccbot|meta-externalagent/i;

/**
 * האם הבקשה מגיעה מבוט/סורק/כלי אוטומטי - לפי ה-User-Agent.
 * בקשה בלי UA בכלל אינה דפדפן של בן אדם.
 */
export function isBotRequest(req: NextRequest): boolean {
  const ua = req.headers.get("user-agent");
  if (!ua) return true;
  return BOT_UA_RE.test(ua);
}
