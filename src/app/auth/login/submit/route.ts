import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const LOCK_MINUTES = 15;

async function getLoginKey(request: Request, email: string) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip = request.headers.get("cf-connecting-ip") ?? forwardedFor?.split(",")[0]?.trim() ?? "unknown";
  const raw = `${email.toLowerCase()}|${ip}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function redirectToAuth(request: Request, params: Record<string, string>) {
  const url = new URL("/auth", request.url);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");

  if (!email || !password) {
    return redirectToAuth(request, { error: "invalid_credentials" });
  }

  const supabase = await createClient();
  const key = await getLoginKey(request, email);

  const { data: limit, error: limitError } = await supabase.rpc("check_login_rate_limit", { p_key: key });

  if (limitError || !limit?.[0]) {
    return redirectToAuth(request, { error: "security_unavailable" });
  }

  if (!limit[0].allowed) {
    return redirectToAuth(request, {
      error: "too_many_attempts",
      retry: String(limit[0].retry_after_seconds),
    });
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.code === "email_not_confirmed" || error.message.toLowerCase().includes("email not confirmed")) {
      return redirectToAuth(request, { error: "email_not_confirmed" });
    }

    const { data: failure } = await supabase.rpc("record_login_failure", { p_key: key });
    const result = failure?.[0];

    if (result?.locked) {
      return redirectToAuth(request, {
        error: "too_many_attempts",
        retry: String(result.retry_after_seconds || LOCK_MINUTES * 60),
      });
    }

    return redirectToAuth(request, {
      error: "invalid_credentials",
      attempts: String(result?.failed_attempts ?? 1),
    });
  }

  await supabase.rpc("clear_login_failures", { p_key: key });
  return NextResponse.redirect(new URL("/workspace", request.url), 303);
}
