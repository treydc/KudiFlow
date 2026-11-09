import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

async function sign(secret: string, body: string) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-512" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  const body = await req.text();
  const signature = req.headers.get("x-paystack-signature") ?? "";
  const expected = await sign(Deno.env.get("PAYSTACK_SECRET_KEY")!, body);
  if (signature !== expected) return new Response("Invalid signature", { status: 401 });

  const event = JSON.parse(body);
  if (event.event !== "charge.success") return new Response("ignored", { status: 200 });

  const d = event.data;
  const invoiceId = d.metadata?.invoice_id;
  if (!invoiceId) return new Response("no invoice", { status: 200 });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Recalculate the total ourselves and compare it with what was actually paid
  const { data: items } = await admin.from("invoice_items")
    .select("quantity, unit_price").eq("invoice_id", invoiceId);
  const expectedKobo = Math.round(
    (items ?? []).reduce((s, i) => s + Number(i.quantity) * Number(i.unit_price), 0) * 100,
  );
  if (d.amount !== expectedKobo || d.currency !== "NGN") {
    return new Response("amount mismatch", { status: 200 });
  }

  // The unique reference makes this safe to receive twice
  const { error } = await admin.from("payments").insert({
    invoice_id: invoiceId,
    reference: d.reference,
    amount_kobo: d.amount,
    status: "success",
    raw: event,
  });
  if (error) {
    if (error.code === "23505") return new Response("already processed", { status: 200 });
    return new Response("error", { status: 500 }); // Paystack will retry
  }

  await admin.from("invoices")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", invoiceId);

  return new Response("ok", { status: 200 });
});