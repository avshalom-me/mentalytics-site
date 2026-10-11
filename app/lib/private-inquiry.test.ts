import { beforeEach, describe, expect, it, vi } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";

// 11/10/2026: what a patient writes to a therapist or a centre through the site
// belongs to the recipient. Until then the sender's name, contact and message
// sat in crm_leads and every admin screen that read the table showed them. The
// owner's rule: the admin counts these inquiries and never sees who wrote them
// or what they wrote.
//
// Three kinds of test, because each catches a different mistake:
//   - the pure helper that strips a row before it leaves for the admin;
//   - the routes, run for real against a stand-in database;
//   - a scan of the source, so a NEW screen cannot reach the content unnoticed.
// Names, numbers and texts below are invented.

const h = vi.hoisted(() => ({
  /** every insert, in order */
  writes: [] as { table: string; row: Record<string, unknown> }[],
  /** what a read of each table answers */
  rows: {} as Record<string, Record<string, unknown>[]>,
  sendInquiryEmail: vi.fn(),
  /** where the therapist's mail lands: their own mailbox, or their centre's */
  recipient: { to: "therapist@example.com", viaCenter: null as { id: string; name: string } | null },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/app/lib/supabaseAdmin", () => {
  type Resolve = (value: unknown) => unknown;
  const table = (name: string) => {
    const chain: Record<string, unknown> = {};
    for (const method of ["select", "eq", "neq", "in", "not", "or", "order", "limit", "gte", "lte", "ilike"]) {
      chain[method] = () => chain;
    }
    const first = async () => ({ data: (h.rows[name] ?? [])[0] ?? null, error: null });
    chain.maybeSingle = first;
    chain.single = first;
    // awaiting the query itself answers with all the table's rows
    chain.then = (resolve: Resolve) => Promise.resolve({ data: h.rows[name] ?? [], error: null }).then(resolve);
    chain.insert = (row: Record<string, unknown>) => {
      h.writes.push({ table: name, row });
      return {
        select: () => ({ single: async () => ({ data: { id: `${name}-new-id` }, error: null }) }),
        then: (resolve: Resolve) => Promise.resolve({ error: null }).then(resolve),
      };
    };
    return chain;
  };
  return { supabaseAdmin: { from: (name: string) => table(name) } };
});
vi.mock("@/app/lib/inquiry-send", () => ({
  sendInquiryEmail: (...args: unknown[]) => h.sendInquiryEmail(...args),
  INQUIRY_SEND_FAILED_MESSAGE: "the message was not sent",
}));
vi.mock("@/app/lib/therapist-recipient", () => ({
  patientInquiryRecipient: async () => h.recipient,
}));

import { isPrivateInquiry, withoutPrivateContent, PRIVATE_INQUIRY_NOTICE } from "./private-inquiry";
import { GET as leadsGET } from "@/app/api/admin-crm/leads/route";
import { GET as timelineGET } from "@/app/api/admin-crm/timeline/route";
import { POST as contactTherapistPOST } from "@/app/api/contact-therapist/route";
import { POST as contactCenterPOST } from "@/app/api/contact-center/route";

// What a patient typed. None of it may reach the admin.
const PATIENT = {
  name: "דנה לוי-בדיקה",
  contact: "0501234567",
  message: "שלום, אני מחפשת טיפול בעקבות תקופה קשה ואשמח לשמוע פרטים.",
};
const SECRETS = [PATIENT.name, PATIENT.contact, PATIENT.message];
const THERAPIST = "11111111-2222-4333-8444-555555555555";
const CENTER = "99999999-8888-4777-8666-555555555555";

const privateLead = (over: Record<string, unknown> = {}) => ({
  id: "lead-private",
  lead_type: "patient",
  source: "site_message",
  // a row from before the content was moved out, or one a future bug wrote
  name: PATIENT.name,
  contact: PATIENT.contact,
  message: PATIENT.message,
  therapist_id: THERAPIST,
  center_account_id: null,
  status: "new",
  created_at: "2026-10-10T10:00:00Z",
  ...over,
});
const companyLead = {
  id: "lead-company",
  lead_type: "general",
  source: "contact_form",
  name: "יוסי כהן-בדיקה",
  contact: "yossi@example.com",
  message: "[שאלה] איך מצטרפים כמטפל?",
  therapist_id: null,
  center_account_id: null,
  status: "new",
  created_at: "2026-10-10T11:00:00Z",
};

let request = 0;
const address = () => `10.9.${Math.floor(++request / 200)}.${(request % 200) + 1}`;
const post = (url: string, body: unknown) =>
  new NextRequest(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": address(), "user-agent": "Mozilla/5.0 test" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  h.writes = [];
  h.rows = {};
  h.sendInquiryEmail.mockReset();
  h.sendInquiryEmail.mockResolvedValue({ ok: true, id: "mail-1" });
  h.recipient = { to: "therapist@example.com", viaCenter: null };
});

describe("withoutPrivateContent", () => {
  it("empties the three fields of a patient's message and marks the row", () => {
    const out = withoutPrivateContent(privateLead());
    expect(out).toMatchObject({ name: null, contact: null, message: null, content_private: true });
    // everything the admin counts by stays
    expect(out).toMatchObject({ id: "lead-private", therapist_id: THERAPIST, status: "new", source: "site_message" });
    for (const secret of SECRETS) expect(JSON.stringify(out)).not.toContain(secret);
  });

  it("leaves an inquiry addressed to the company as it is", () => {
    expect(withoutPrivateContent(companyLead)).toEqual({ ...companyLead, content_private: false });
  });

  it("knows a private inquiry by its source only", () => {
    expect(isPrivateInquiry({ source: "site_message" })).toBe(true);
    for (const source of ["contact_form", "quiz_feedback", "manual", "", null, undefined]) {
      expect(isPrivateInquiry({ source })).toBe(false);
    }
    expect(isPrivateInquiry(null)).toBe(false);
  });
});

describe("the admin never receives what a patient wrote", () => {
  it("/api/admin-crm/leads returns the row for counting, without the content", async () => {
    h.rows.crm_leads = [privateLead(), companyLead];
    h.rows.therapists = [{ id: THERAPIST, full_name: "מטפלת לדוגמה" }];
    const res = await leadsGET(new NextRequest("http://localhost/api/admin-crm/leads?archived=false"));
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.leads).toHaveLength(2);
    expect(body.leads[0]).toMatchObject({
      id: "lead-private",
      name: null,
      contact: null,
      message: null,
      content_private: true,
      therapist_name: "מטפלת לדוגמה",
    });
    for (const secret of SECRETS) expect(JSON.stringify(body)).not.toContain(secret);
    // the company's own inquiries are untouched
    expect(body.leads[1]).toMatchObject({ id: "lead-company", name: companyLead.name, message: companyLead.message });
  });

  it("the therapist card's timeline says an inquiry arrived, not from whom", async () => {
    h.rows.therapists = [{ email: "therapist@example.com", created_at: "2026-01-01T00:00:00Z" }];
    h.rows.crm_leads = [privateLead()];
    const res = await timelineGET(new NextRequest(`http://localhost/api/admin-crm/timeline?therapist_id=${THERAPIST}`));
    const body = await res.json();
    const text = JSON.stringify(body);
    for (const secret of SECRETS) expect(text).not.toContain(secret);
    expect(text).toContain(PRIVATE_INQUIRY_NOTICE);
  });
});

describe("what is kept of a patient's message", () => {
  const therapistRow = {
    id: THERAPIST, full_name: "מטפלת לדוגמה", email: "therapist@example.com", status: "approved",
    accepting_new_patients: true, entity_type: null, center_account_id: null,
  };
  const toTherapist = () =>
    contactTherapistPOST(
      post("http://localhost/api/contact-therapist", {
        therapist_id: THERAPIST,
        sender_name: PATIENT.name,
        sender_contact: PATIENT.contact,
        message: PATIENT.message,
        source: "profile",
        session_id: "visit-1",
      }),
    );

  // The owner's decision: what goes straight to a therapist we only need to know
  // about, not to hold. Nothing of it is written anywhere in the database.
  it("to a therapist's own mailbox: counted, and nothing of its content is kept at all", async () => {
    h.rows.therapists = [therapistRow];
    expect(await (await toTherapist()).json()).toEqual({ ok: true });
    expect(h.writes.map((w) => w.table).sort()).toEqual(["crm_leads", "therapist_contact_clicks"]);
    for (const w of h.writes) {
      for (const secret of SECRETS) expect(JSON.stringify(w.row)).not.toContain(secret);
    }
    expect(h.writes.find((w) => w.table === "crm_leads")!.row).toMatchObject({
      lead_type: "patient", source: "site_message", therapist_id: THERAPIST, received_by_center_id: null,
    });
    // the therapist is the only one who gets it
    const [mail] = h.sendInquiryEmail.mock.calls[0] as [{ to: string; html: string }];
    expect(mail.to).toBe("therapist@example.com");
    expect(mail.html).toContain(PATIENT.message);
  });

  it("to a therapist whose mail lands in the centre's mailbox: kept for that centre's portal only", async () => {
    h.rows.therapists = [{ ...therapistRow, email: null, center_account_id: CENTER }];
    h.recipient = { to: "office@example.com", viaCenter: { id: CENTER, name: "מרכז לדוגמה" } };
    expect(await (await toTherapist()).json()).toEqual({ ok: true });
    const lead = h.writes.find((w) => w.table === "crm_leads")!.row;
    expect(lead).toMatchObject({ source: "site_message", therapist_id: THERAPIST, received_by_center_id: CENTER });
    for (const secret of SECRETS) expect(JSON.stringify(lead)).not.toContain(secret);
    expect(h.writes.filter((w) => w.table === "private_inquiries").map((w) => w.row)).toEqual([
      { lead_id: "crm_leads-new-id", sender_name: PATIENT.name, sender_contact: PATIENT.contact, message: PATIENT.message },
    ]);
  });

  it("the lead row carries no content, the recipient's mail does", async () => {
    h.rows.therapists = [
      { id: THERAPIST, full_name: "מטפלת לדוגמה", email: "therapist@example.com", status: "approved", accepting_new_patients: true, entity_type: null, center_account_id: null },
    ];
    const res = await contactTherapistPOST(
      post("http://localhost/api/contact-therapist", {
        therapist_id: THERAPIST,
        sender_name: PATIENT.name,
        sender_contact: PATIENT.contact,
        message: PATIENT.message,
        source: "profile",
        session_id: "visit-1",
      }),
    );
    expect(await res.json()).toEqual({ ok: true });

    const lead = h.writes.find((w) => w.table === "crm_leads")!.row;
    expect(lead).toMatchObject({ lead_type: "patient", source: "site_message", therapist_id: THERAPIST, page_source: "profile" });
    for (const key of ["name", "contact", "message"]) expect(lead).not.toHaveProperty(key);
    for (const secret of SECRETS) expect(JSON.stringify(lead)).not.toContain(secret);

    // the click that counts the inquiry knows nothing about its content either
    const click = h.writes.find((w) => w.table === "therapist_contact_clicks")!.row;
    for (const secret of SECRETS) expect(JSON.stringify(click)).not.toContain(secret);

    // nothing sensitive was written anywhere
    for (const w of h.writes) {
      for (const secret of SECRETS) expect(JSON.stringify(w.row)).not.toContain(secret);
    }

    // and the therapist still gets all of it
    const [mail] = h.sendInquiryEmail.mock.calls[0] as [{ to: string; html: string; subject: string }];
    expect(mail.to).toBe("therapist@example.com");
    expect(mail.html).toContain(PATIENT.message);
    expect(mail.html).toContain(PATIENT.name);
    // the subject is logged in crm_email_log, so it must stay generic
    for (const secret of SECRETS) expect(mail.subject).not.toContain(secret);
  });

  it("to a centre: the same split", async () => {
    h.rows.therapy_center_accounts = [
      { id: CENTER, name: "מרכז לדוגמה", email: "office@example.com", payer_email: null, billing_track: "therapists", public_page_enabled: true, status: "active" },
    ];
    const res = await contactCenterPOST(
      post("http://localhost/api/contact-center", {
        center_id: CENTER,
        sender_name: PATIENT.name,
        sender_contact: PATIENT.contact,
        message: PATIENT.message,
        source: "profile",
      }),
    );
    expect(await res.json()).toEqual({ ok: true });

    const lead = h.writes.find((w) => w.table === "crm_leads")!.row;
    expect(lead).toMatchObject({ source: "site_message", center_account_id: CENTER, received_by_center_id: CENTER });
    for (const key of ["name", "contact", "message"]) expect(lead).not.toHaveProperty(key);
    for (const secret of SECRETS) expect(JSON.stringify(lead)).not.toContain(secret);
    expect(h.writes.filter((w) => w.table === "private_inquiries").map((w) => w.row)).toEqual([
      { lead_id: "crm_leads-new-id", sender_name: PATIENT.name, sender_contact: PATIENT.contact, message: PATIENT.message },
    ]);
    const [mail] = h.sendInquiryEmail.mock.calls[0] as [{ to: string; html: string; subject: string }];
    expect(mail.to).toBe("office@example.com");
    for (const secret of SECRETS) expect(mail.subject).not.toContain(secret);
  });
});

// ── the source scan ──────────────────────────────────────────────────────────
// The content has exactly one home and one reader. A new admin screen, agent or
// export that reaches for it fails here, before it is deployed.

const ROOT = process.cwd();
function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}
const rel = (file: string) => path.relative(ROOT, file).split(path.sep).join("/");
const SOURCES = sourceFiles(path.join(ROOT, "app")).map((file) => ({ file: rel(file), text: readFileSync(file, "utf8") }));
const filesWith = (needle: string | RegExp) =>
  SOURCES.filter((s) => (typeof needle === "string" ? s.text.includes(needle) : needle.test(s.text)))
    .map((s) => s.file)
    .filter((file) => file !== "app/lib/private-inquiry.test.ts")
    .sort();

describe("who may touch the content (a scan of the source)", () => {
  it("only the store names the table", () => {
    expect(filesWith("private_inquiries")).toEqual(["app/lib/private-inquiry-store.ts"]);
  });

  it("only the two routes that receive a message, and the centre portal, import the store", () => {
    expect(filesWith(/private-inquiry-store["']/)).toEqual([
      "app/api/contact-center/route.ts",
      "app/api/contact-therapist/route.ts",
      "app/lib/center-portal-data.ts",
    ]);
  });

  it("only the centre portal reads the content back", () => {
    expect(filesWith("loadPrivateInquiries")).toEqual(["app/lib/center-portal-data.ts", "app/lib/private-inquiry-store.ts"]);
  });

  it("only the centre's own portal asks for message content - the admin's preview does not", () => {
    expect(filesWith(/messageContent:\s*true/)).toEqual(["app/api/center-portal/route.ts"]);
    const adminPreview = SOURCES.find((s) => s.file === "app/api/admin-centers/route.ts")!.text;
    expect(adminPreview).toContain("buildCenterPortalPayload(");
    expect(adminPreview).not.toMatch(/messageContent/);
  });

  it("nothing under the admin reaches the store", () => {
    const admin = SOURCES.filter((s) => s.file.startsWith("app/admin/") || s.file.startsWith("app/api/admin-"));
    expect(admin.length).toBeGreaterThan(20);
    for (const s of admin) {
      expect(s.text, s.file).not.toMatch(/private-inquiry-store|private_inquiries|loadPrivateInquiries/);
    }
  });

  it("the content table is not in the Drive backup", () => {
    const backup = SOURCES.find((s) => s.file === "app/lib/backup-run.ts")!.text;
    expect(backup).toContain('"crm_leads"');
    expect(backup).not.toContain("private_inquiries");
  });

  it("the migration locks the table and forbids the content in crm_leads", () => {
    const dir = path.join(ROOT, "supabase", "migrations");
    const sql = readdirSync(dir)
      .filter((f) => f.endsWith("_private_inquiries.sql"))
      .map((f) => readFileSync(path.join(dir, f), "utf8"))
      .join("\n");
    expect(sql).toMatch(/alter table public\.private_inquiries enable row level security/);
    expect(sql).toMatch(/revoke all on public\.private_inquiries from public, anon, authenticated/);
    expect(sql).toMatch(/crm_leads_site_message_has_no_content/);
    // the trigger empties the three columns before the constraint is checked, so
    // a refused row (which Postgres would print into its log) never happens
    expect(sql).toMatch(/create trigger crm_leads_strip_private_content\s+before insert or update on public\.crm_leads/);
    expect(sql).not.toMatch(/create policy/i);
  });

  it("the GitHub database dump leaves the content rows out", () => {
    const workflow = readFileSync(path.join(ROOT, ".github", "workflows", "daily-backup.yml"), "utf8");
    expect(workflow).toMatch(/pg_dump[^\n]*--exclude-table-data=public\.private_inquiries/);
  });

  // The archives were artifacts of a public repository: anyone signed in to
  // GitHub could download the whole database, encrypted. The owner stopped it.
  it("the GitHub backup no longer runs on a schedule", () => {
    const workflow = readFileSync(path.join(ROOT, ".github", "workflows", "daily-backup.yml"), "utf8");
    expect(workflow).not.toMatch(/^\s*schedule:/m);
    expect(workflow).not.toMatch(/^\s*- cron:/m);
  });
});
