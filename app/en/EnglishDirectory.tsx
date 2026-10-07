"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { EnglishCard } from "@/app/lib/english-directory";
import { useImpressionTrack } from "@/app/lib/useTrack";
import { waLinkFor, waLinkForCenter, telHref } from "@/app/lib/phone";
import { gaEvent } from "@/app/lib/gtag";
import { getAttribution } from "@/app/lib/attribution";
import { getOrCreateSessionId } from "@/app/lib/session";
import { clickSignals } from "@/app/lib/click-signals";
import { trackingOptedOut } from "@/app/lib/track-optout";
import SiteMessageModal from "@/app/therapists/SiteMessageModal";
import CenterWhatsAppLink from "@/app/centers/[slug]/CenterWhatsAppLink";

// The prewritten WhatsApp opener, in English. It names the site so the
// therapist knows where the contact came from, as the Hebrew one does.
const WHATSAPP_TEXT = "Hi, I found you through Tipul Chacham (mentalytics.co.il) and would like to hear about therapy in English.";
const CENTER_WHATSAPP_TEXT = "Hi, I found your clinic through Tipul Chacham (mentalytics.co.il) and would like to hear about therapy in English.";

function withText(link: string | null, text: string): string | null {
  return link ? link.replace(/\?text=.*$/, `?text=${encodeURIComponent(text)}`) : null;
}

// Same record as a card click in the Hebrew directory (source "directory"):
// the surface is a directory listing, and the source list is a DB constraint.
// The page's own page_view ("english-directory") tells the two pages apart.
function trackClick(therapistId: string, clickType: "whatsapp" | "phone") {
  if (trackingOptedOut()) return;
  fetch("/api/track-click", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    body: JSON.stringify({
      therapist_id: therapistId,
      click_type: clickType,
      source: "directory",
      session_id: getOrCreateSessionId(),
      ...clickSignals(),
      ...(getAttribution() ?? {}),
    }),
  }).catch(() => {});
  gaEvent("generate_lead", { method: clickType, source: "directory" });
}

// Per-visit shuffle within each tier, as in the Hebrew directory: paying cards
// stay above gift cards, and nobody is permanently first.
function shuffleWithinTiers(list: EnglishCard[]): EnglishCard[] {
  const byTier = new Map<number, EnglishCard[]>();
  for (const c of list) {
    const group = byTier.get(c.tier) ?? [];
    group.push(c);
    byTier.set(c.tier, group);
  }
  const out: EnglishCard[] = [];
  for (const tier of [...byTier.keys()].sort((a, b) => a - b)) {
    const group = byTier.get(tier)!;
    for (let i = group.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [group[i], group[j]] = [group[j], group[i]];
    }
    out.push(...group);
  }
  return out;
}

const WA_ICON = (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
);

const MESSAGE_ICON = (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
);

const PHONE_ICON = (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.06 6.06l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
);

function avatarFor(gender: EnglishCard["gender"]): string {
  return gender === "f" ? "/avatar-female.svg" : gender === "m" ? "/avatar-male.svg" : "/avatar-neutral.svg";
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2 text-[13px] leading-6">
      <span className="shrink-0 font-semibold" style={{ color: "var(--muted)", minWidth: "96px" }}>{label}</span>
      <span style={{ color: "var(--text-2)" }}>{children}</span>
    </div>
  );
}

function Card({ c, position, eager }: { c: EnglishCard; position: number; eager: boolean }) {
  const impressionRef = useImpressionTrack(c.trackable ? c.id : null, position);
  const [messageOpen, setMessageOpen] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  const photo = c.photoUrl && !photoFailed ? c.photoUrl : null;
  const wa = c.isCenter
    ? withText(waLinkForCenter(c.centerWhatsapp), CENTER_WHATSAPP_TEXT)
    : withText(waLinkFor(c.phone), WHATSAPP_TEXT);
  const tel = c.isCenter ? null : telHref(c.phone);
  const pill = "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-bold";

  const body = (
    <>
      <div className="relative h-72 w-full overflow-hidden" style={{ background: c.isCenter ? "var(--teal-pale)" : "var(--surface-2)" }}>
        {c.isCenter && !photo ? (
          <div className="flex h-full w-full items-center justify-center"><span className="text-6xl" aria-hidden>🏢</span></div>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={photo ?? avatarFor(c.gender)}
            alt=""
            className={`h-full w-full ${c.isCenter ? "object-contain p-6" : "object-cover object-top"}`}
            loading={eager ? "eager" : "lazy"}
            decoding="async"
            onError={() => setPhotoFailed(true)}
          />
        )}
        <span className="absolute top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[12px] font-bold"
          style={{ insetInlineStart: "12px", color: "var(--teal-dark)", boxShadow: "0 1px 4px rgba(0,0,0,.12)" }}>
          {c.isCenter ? "🏢 Therapy clinic" : "✓ Verified credentials"}
        </span>
      </div>
      <div className="px-5 pt-4 pb-3">
        <div className="font-black text-lg leading-tight" style={{ color: "var(--text)" }}>
          <bdi lang="he">{c.name}</bdi>
        </div>
        {c.title && <div className="mt-1 text-sm font-semibold" style={{ color: "var(--teal)" }}>{c.title}</div>}
        {c.centerName && (
          <div className="mt-1 text-[12.5px] font-semibold" style={{ color: "var(--muted)" }}>
            🏢 Part of <bdi lang="he">{c.centerName}</bdi>
          </div>
        )}
        {c.isCenter && c.englishTeam != null && c.englishTeam > 0 && (
          <div className="mt-1 text-sm font-semibold" style={{ color: "var(--teal)" }}>
            {c.englishTeam === 1 ? "1 English-speaking therapist on the team" : `${c.englishTeam} English-speaking therapists on the team`}
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {c.online && (
            <span className="rounded-full px-3 py-1 text-[13px] font-semibold" style={{ background: "var(--teal-pale)", border: "1px solid var(--teal-mid)", color: "var(--teal-dark)" }}>🌐 Online sessions</span>
          )}
          {c.places.length > 0 && (
            <span className="rounded-full px-3 py-1 text-[13px] font-semibold" style={{ background: "var(--surface)", border: "1px solid var(--line)", color: "var(--text-2)" }}>📍 {c.places.join(", ")}</span>
          )}
        </div>
        <div className="mt-3 space-y-0.5">
          {c.languages.length > 0 && <Detail label="Languages">{c.languages.join(" · ")}</Detail>}
          {c.ages.length > 0 && <Detail label="Works with">{c.ages.join(" · ")}</Detail>}
          {c.approaches.length > 0 && <Detail label="Approaches">{c.approaches.join(" · ")}</Detail>}
          {c.funding.length > 0 && <Detail label="Funding">{c.funding.join(" · ")}</Detail>}
          {c.cultural.length > 0 && <Detail label="Familiar with">{c.cultural.join(" · ")}</Detail>}
        </div>
      </div>
    </>
  );

  return (
    <div
      ref={impressionRef}
      data-tier="promoted"
      className="flex flex-col rounded-2xl bg-white overflow-hidden transition hover:shadow-lg hover:-translate-y-0.5"
      style={{ border: "1px solid var(--line)", boxShadow: "0 2px 10px rgba(61,140,138,.06)" }}
    >
      {c.href ? <Link href={c.href} className="block flex-1">{body}</Link> : <div className="flex-1">{body}</div>}
      <div className="px-5 pb-5 flex flex-wrap items-center gap-2 pt-3" style={{ borderTop: "1px solid var(--surface-2)" }}>
        {!c.accepting ? (
          <span className={pill} style={{ background: "var(--surface-2)", border: "1px solid var(--line)", color: "var(--muted)" }}>
            ⏸ Not taking new clients right now
          </span>
        ) : (
          <>
            {wa && c.isCenter && (
              <CenterWhatsAppLink
                entityId={c.trackable ? c.id : undefined}
                centerId={c.centerAccountId ?? undefined}
                href={wa}
                source="directory"
                className={`${pill} bg-[#128C42] text-white hover:bg-[#0F7A39]`}>
                {WA_ICON}WhatsApp
              </CenterWhatsAppLink>
            )}
            {wa && !c.isCenter && (
              <a href={wa} target="_blank" rel="noopener noreferrer" onClick={() => trackClick(c.id, "whatsapp")}
                className={`${pill} bg-[#128C42] text-white hover:bg-[#0F7A39]`}>
                {WA_ICON}WhatsApp
              </a>
            )}
            {tel && (
              <a href={tel} onClick={() => trackClick(c.id, "phone")}
                className={`${pill} bg-stone-100 text-stone-700 hover:bg-stone-200`}>
                {PHONE_ICON}Call
              </a>
            )}
            {/* A synthetic clinic card has no therapists row to address a message to. */}
            {c.trackable && (
              <button type="button" onClick={() => setMessageOpen(true)}
                className={`${pill} text-white hover:opacity-90`} style={{ background: "var(--teal)" }}>
                {MESSAGE_ICON}Message
              </button>
            )}
          </>
        )}
        {c.href && (
          <Link href={c.href} className="text-[13px] font-bold hover:underline" style={{ color: "var(--teal)", marginInlineStart: "auto" }}>
            {c.isCenter ? "Clinic page" : "Full profile"} <span style={{ fontWeight: 400, color: "var(--muted)" }}>(Hebrew)</span> →
          </Link>
        )}
      </div>
      {c.trackable && (
        <SiteMessageModal
          therapistId={c.id}
          therapistName={c.name}
          source="directory"
          recipientIsCenter={c.isCenter}
          lang="en"
          open={messageOpen}
          onClose={() => setMessageOpen(false)}
        />
      )}
    </div>
  );
}

type Audience = "" | "adults" | "children";

export default function EnglishDirectory({ cards }: { cards: EnglishCard[] }) {
  // Server order first, so the first client render matches the HTML; the
  // shuffle runs right after mount.
  const [list, setList] = useState<EnglishCard[]>(cards);
  useEffect(() => {
    setList(shuffleWithinTiers(cards));
  }, [cards]);

  const [region, setRegion] = useState("");
  const [audience, setAudience] = useState<Audience>("");
  const [onlineOnly, setOnlineOnly] = useState(false);

  const regions = useMemo(() => {
    const set = new Set<string>();
    for (const c of cards) for (const r of c.regions) set.add(r);
    return [...set].sort((a, b) => a.localeCompare(b, "en"));
  }, [cards]);

  const shown = list.filter((c) => {
    if (onlineOnly && !c.online) return false;
    if (region && !c.regions.includes(region)) return false;
    // A clinic card lists no ages of its own: it stays in every audience view.
    const knownAges = c.adults || c.children;
    if (audience === "adults" && knownAges && !c.adults) return false;
    if (audience === "children" && knownAges && !c.children) return false;
    return true;
  });

  const filtered = region !== "" || audience !== "" || onlineOnly;
  const chip = (active: boolean) => ({
    background: active ? "var(--teal)" : "white",
    color: active ? "white" : "var(--text-2)",
    borderColor: active ? "var(--teal)" : "var(--line)",
  });

  return (
    <>
      <div className="mb-7 flex flex-wrap items-center gap-3 p-4 rounded-2xl" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
        <label className="sr-only" htmlFor="en-region">Region</label>
        <select
          id="en-region"
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          className="rounded-xl bg-white px-3 py-2 text-sm focus:outline-none"
          style={{ border: "1px solid var(--line)", color: "var(--text)" }}
        >
          <option value="">All regions</option>
          {regions.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <div role="group" aria-label="Works with" className="flex flex-wrap gap-2">
          {([["", "All ages"], ["adults", "Adults"], ["children", "Children and teens"]] as const).map(([key, label]) => (
            <button key={key || "all"} type="button" aria-pressed={audience === key} onClick={() => setAudience(key)}
              className="rounded-xl px-3 py-2 text-sm font-semibold border transition-colors" style={chip(audience === key)}>
              {label}
            </button>
          ))}
        </div>
        <button type="button" aria-pressed={onlineOnly} onClick={() => setOnlineOnly((v) => !v)}
          className="rounded-xl px-3 py-2 text-sm font-semibold border transition-colors" style={chip(onlineOnly)}>
          🌐 Online sessions
        </button>
        {filtered && (
          <button type="button" onClick={() => { setRegion(""); setAudience(""); setOnlineOnly(false); }}
            style={{ fontSize: "12px", color: "var(--muted)", textDecoration: "underline", background: "none", border: "none", cursor: "pointer" }}>
            Clear
          </button>
        )}
        <span className="text-[13px]" style={{ color: "var(--muted)", marginInlineStart: "auto" }} aria-live="polite">
          {shown.length === cards.length ? `${cards.length} listed` : `${shown.length} of ${cards.length}`}
        </span>
      </div>

      {shown.length === 0 ? (
        <p className="text-center py-10" style={{ color: "var(--muted)" }}>
          No one matches these filters yet. Try another region, or turn on online sessions.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((c, i) => <Card key={c.id} c={c} position={i} eager={i < 6} />)}
        </div>
      )}
    </>
  );
}
