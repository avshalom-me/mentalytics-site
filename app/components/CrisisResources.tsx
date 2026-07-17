// קופסת עזרה מיידית — מוצגת ברגע שמשתמש/ת מסמנ/ת מצוקה אובדנית בשאלון,
// ולא רק בסיכום בסוף. הנוסח רך, תומך ואנושי (לא אזהרה אדומה מבהילה),
// בהתאם לאופי המוצר — מקום שמבין כאב, לא אפליקציית בריאות גנרית.
export function CrisisResources({ className = "" }: { className?: string }) {
  return (
    <div
      dir="rtl"
      role="note"
      className={`rounded-2xl border p-4 text-sm leading-6 ${className}`}
      style={{ borderColor: "#C2DFDE", background: "#EAF4F3", color: "#2A6462" }}
    >
      <p className="mb-1 font-bold">אם קשה לך עכשיו — יש עם מי לדבר, מייד.</p>
      <p>
        אפשר לפנות ל<strong>ער&quot;ן — עזרה ראשונה נפשית</strong>: שיחה חינם, אנונימית וזמינה 24 שעות —{" "}
        <a href="tel:1201" className="font-black underline underline-offset-2">1201</a>.{" "}
        במצב חירום מיידי חייגו <a href="tel:101" className="font-black underline underline-offset-2">101</a>.
      </p>
    </div>
  );
}
