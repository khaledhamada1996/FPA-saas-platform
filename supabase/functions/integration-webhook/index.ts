import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const jsonHeaders = { "Content-Type": "application/json" };
function hex(bytes: ArrayBuffer) { return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join(""); }
function timingSafeEqual(a: string, b: string) { if (a.length !== b.length) return false; let diff = 0; for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i); return diff === 0; }
async function hmacSha256(secret: string, message: string) { const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]); return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message))); }
Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: jsonHeaders });
  try {
    const url = new URL(req.url);
    const connectorId = url.pathname.split("/").filter(Boolean).pop();
    if (!connectorId) throw new Error("Connector id is required");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) throw new Error("Supabase function environment is incomplete");
    const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: connector, error: connectorError } = await admin.from("data_source_connectors").select("id,organization_id,data_source_id,webhook_enabled,webhook_secret_ref,connector_id,connector_catalog:connector_id(connector_key)").eq("id", connectorId).maybeSingle();
    if (connectorError) throw connectorError;
    if (!connector || !connector.webhook_enabled) throw new Error("Webhook connector is not enabled");
    const provider = String((connector.connector_catalog as { connector_key?: string } | null)?.connector_key || "");
    const rawBody = await req.text();
    if (rawBody.length > 2_000_000) throw new Error("Payload too large");
    const deliveryId = req.headers.get("X-Qoyod-Delivery") || req.headers.get("X-Delivery-Id") || "";
    const signature = req.headers.get("X-Qoyod-Signature") || req.headers.get("X-Signature") || "";
    const timestamp = req.headers.get("X-Qoyod-Timestamp") || req.headers.get("X-Timestamp") || "";
    if (!connector.webhook_secret_ref) throw new Error("Webhook secret is not configured");
    const { data: secretRow, error: secretError } = await admin.schema("vault").from("decrypted_secrets").select("decrypted_secret").eq("name", connector.webhook_secret_ref).maybeSingle();
    if (secretError) throw secretError;
    const secret = secretRow?.decrypted_secret;
    if (!secret) throw new Error("Webhook secret not found");
    if (timestamp) { const ts = Number(timestamp); if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) throw new Error("Stale webhook timestamp"); }
    const payload = JSON.parse(rawBody);
    const signedMessage = timestamp ? timestamp + "." + rawBody : rawBody;
    const expected = await hmacSha256(secret, signedMessage);
    const provided = signature.replace(/^sha256=/i, "");
    if (!signature || !timingSafeEqual(expected.toLowerCase(), provided.toLowerCase())) throw new Error("Invalid webhook signature");
    const externalEventId = String(payload?.id || deliveryId || "").trim();
    if (!externalEventId) throw new Error("External event id is required");
    const eventType = String(payload?.type || req.headers.get("X-Qoyod-Event") || "unknown").trim();
    const occurredAt = payload?.createdAt ? new Date(payload.createdAt).toISOString() : null;
    const { data: eventId, error: eventError } = await admin.rpc("record_integration_event", { p_organization_id: connector.organization_id, p_data_source_id: connector.data_source_id, p_connector_id: connector.id, p_provider: provider, p_event_type: eventType, p_external_event_id: externalEventId, p_delivery_id: deliveryId || null, p_signature_verified: true, p_occurred_at: occurredAt, p_payload: payload });
    if (eventError) throw eventError;
    return new Response(JSON.stringify({ ok: true, event_id: eventId }), { status: 200, headers: jsonHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Webhook rejected" }), { status: 400, headers: jsonHeaders });
  }
});