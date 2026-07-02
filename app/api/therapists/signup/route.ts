// DECOMMISSIONED.
//
// This was a PUBLIC, UNAUTHENTICATED endpoint that wrote to the therapists
// table and Storage with the service-role key and had NO rate limiting — an
// abuse vector (anyone could mass-create therapist rows and upload files).
// New-therapist registration now goes through the account-based flow
// (register → login → dashboard → edit) via the authenticated
// /api/therapist-profile. Anything still hitting this path gets 410 Gone.

export const dynamic = "force-dynamic";

function gone() {
  return Response.json(
    { ok: false, error: "endpoint decommissioned — register at /therapists/join" },
    { status: 410 },
  );
}

export async function POST() {
  return gone();
}

export async function GET() {
  return gone();
}
