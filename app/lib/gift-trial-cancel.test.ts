import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

// 22/10/2026: a therapist on the gift track with a card (gift_trial) asked to go back
// to the free track before her first charge, and the admin had no button for it:
// "בטל מנוי + הורד" showed only for "paid", and "הורד לחינמי" only for manual/trial.
describe("cancelling the gift track with a card from the admin", () => {
  const page = readFileSync("app/admin/therapists/page.tsx", "utf8");
  const route = readFileSync("app/api/admin-therapists/route.ts", "utf8");

  it("the cancel button shows for gift_trial as well as paid", () => {
    expect(page).toContain(
      'therapist.status === "paying" && (therapist.promotion_source === "paid" || therapist.promotion_source === "gift_trial")'
    );
  });

  it("the modal explains the gift track and offers a refund only on the paid track", () => {
    expect(page).toContain('cancelPayingFor.promotion_source === "gift_trial" ?');
    expect(page).toMatch(/\{cancelPayingFor\.promotion_source === "paid" && \(\s*<label/);
  });

  it("the server cancels the standing order on any demotion and sends the cancellation email to gift_trial", () => {
    expect(route).toMatch(/cancelSubscription\(\{\s*recurringItemId: parseInt\(activeSub\.morning_token_id, 10\)/);
    expect(route).toMatch(/before\.promotion_source === "paid" \|\| before\.promotion_source === "gift_trial"\s*\?\s*"customer_cancellation"/);
  });
});
