-- איתור מכונים: עמודת וואטסאפ, ופיצול "המרכז והשפלה" לשני אזורים ברשימה.
--
-- whatsapp: רק מספר שהמכון פרסם במפורש כוואטסאפ (קישור wa.me או "וואטסאפ"
-- באתר). נייד לבדו אינו וואטסאפ, ולכן העמודה לא נגזרת מ-phone.
--
-- region_key ברשימת המכונים עובר למפתחות של PROSPECT_REGION_GROUPS
-- (app/lib/prospect-regions.ts): "center" = גוש דן בלבד, "shfela" = השפלה והמרכז.
-- שורות שהעיר שלהן בשפלה עוברות ל-shfela, ועסקה שנפתחה ממכון כזה מקבלת את
-- אותו מפתח. המפתח הגס של האנליטיקה (viewer_region, התראות פערי הגיוס,
-- gift_offers.region) לא משתנה - שם center נשאר "המרכז והשפלה".
-- הוחל דרך MCP ב-29/9/26.

alter table public.center_prospects add column if not exists whatsapp text;

update public.center_prospects
   set region_key = 'shfela', updated_at = now()
 where region_key = 'center'
   and city in ('ראשון לציון', 'רחובות', 'נס ציונה', 'מודיעין', 'לוד', 'רמלה', 'יבנה', 'גדרה', 'קרית עקרון');

update public.crm_deals d
   set region_key = p.region_key
  from public.center_prospects p
 where d.prospect_id = p.id
   and d.region_key = 'center'
   and p.region_key = 'shfela';

grant select, insert, update, delete on public.center_prospects to service_role;
