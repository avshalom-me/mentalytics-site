/**
 * What a reviewer was pointing at when they clicked.
 *
 * A note is only useful later if it says exactly where it sits. So a click in
 * note mode is resolved to three things: the smallest piece of text under the
 * pointer (the quote - what gets searched for in the code), the block it
 * belongs to when the block carries a data-review-id (a committee card, a tip,
 * a finding), and a label in words for the list of notes.
 *
 * DOM only. No React, no state.
 */

/** The parts a committee card and a finding card are made of, in the reviewer's words. */
export const PART_LABELS: Record<string, string> = {
  decision: "שיקולים להכרעה",
  why: "למה המסלול כאן",
  deadline: "מועד",
  cautions: "אזהרות",
  steps: "צעדים",
  documents: "מסמכים",
  appeals: "ערר",
  verified: "מקור האימות",
  explain: "הסבר: למה זה הוצע",
  variant: "נוסח לפי מצב",
};

const TEXT_TAGS = new Set(["P", "LI", "H1", "H2", "H3", "H4", "BUTTON", "SUMMARY", "LABEL", "PRE", "TD", "TH", "A", "DT", "DD"]);

/** The review mode's own chrome - the bar, the panels, the form. Never a target. */
export const UI_ATTR = "data-review-ui";
/** A part of the chrome that holds reviewable content: the atlas. */
export const SURFACE_ATTR = "data-review-surface";

/** The area a click may land in: the questionnaire, or the atlas. Null for the review chrome itself. */
export function surfaceOf(el: Element): Element | null {
  const atlas = el.closest(`[${SURFACE_ATTR}]`);
  if (atlas) return atlas;
  if (el.closest(`[${UI_ATTR}]`)) return null;
  return el.closest("main.quiz-shell");
}

/** The smallest element with text of its own around the pointer. */
export function pickTarget(start: Element): HTMLElement | null {
  const surface = surfaceOf(start);
  if (!surface) return null;
  let el: Element | null = start;
  while (el && el !== surface) {
    if (el instanceof HTMLElement) {
      const text = (el.innerText || "").trim();
      if (text && (
        TEXT_TAGS.has(el.tagName) ||
        el.hasAttribute("data-review-id") ||
        el.hasAttribute("data-review-part") ||
        (el.tagName === "DIV" && text.length <= 700)
      )) return el;
    }
    el = el.parentElement;
  }
  return null;
}

export interface Anchor {
  blockId: string | null;
  blockLabel: string | null;
  quote: string | null;
  /** The atlas scenario the element sits in, if any. */
  scenario: string | null;
  /** The atlas section, if any. */
  atlasSection: string | null;
  /** The full text of an AI explanation, when the note is on one - it is regenerated on every click, so it is kept as seen. */
  explainText: string | null;
}

const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);
const tidy = (s: string) => s.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

/** The nearest heading above an element, inside its surface: the card title, else the screen title. */
function headingFor(el: Element): string | null {
  const surface = surfaceOf(el);
  let node: Element | null = el;
  while (node && node !== surface) {
    const h: HTMLElement | null = node.querySelector(":scope > h2, :scope > h3, :scope > div > h3");
    if (h?.innerText.trim()) return clip(h.innerText.trim(), 120);
    node = node.parentElement;
  }
  const first = surface?.querySelector("h2");
  return first instanceof HTMLElement && first.innerText.trim() ? clip(first.innerText.trim(), 120) : null;
}

export function anchorOf(el: Element, selection?: string | null): Anchor {
  const idEl = el.closest("[data-review-id]");
  const partEl = el.closest("[data-review-part]");
  const part = partEl && (!idEl || idEl.contains(partEl)) ? partEl.getAttribute("data-review-part") : null;
  const id = idEl?.getAttribute("data-review-id") ?? null;
  const label = idEl?.getAttribute("data-review-label") ?? null;
  const explainEl = el.closest('[data-review-part="explain"]');
  const own = el instanceof HTMLElement ? tidy(el.innerText || "") : "";
  const quote = tidy(selection || "") || own;
  return {
    blockId: part ? (id ? `${id}:${part}` : part) : id,
    blockLabel: [label ?? headingFor(el), part ? PART_LABELS[part] ?? part : null].filter(Boolean).join(" · ") || null,
    quote: quote ? clip(quote, 1500) : null,
    scenario: el.closest("[data-review-scenario]")?.getAttribute("data-review-scenario") ?? null,
    atlasSection: el.closest("[data-atlas-section]")?.getAttribute("data-atlas-section") ?? null,
    explainText: explainEl instanceof HTMLElement ? clip(tidy(explainEl.innerText || ""), 6000) : null,
  };
}

/** Text the reviewer has selected inside a reviewable area, with the element it starts in. */
export function currentSelection(): { text: string; el: Element } | null {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
  const text = sel.toString().trim();
  if (text.length < 2) return null;
  const node = sel.getRangeAt(0).commonAncestorContainer;
  const el = node instanceof Element ? node : node.parentElement;
  if (!el || !surfaceOf(el)) return null;
  return { text, el };
}
