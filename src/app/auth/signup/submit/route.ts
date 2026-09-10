import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");

  if (!email || password.length < 8) {
    return NextResponse.redirect(new URL("/auth/signup?error=signup_failed", request.url), 303);
  }

  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL("/", request.url).origin;
  const emailRedirectTo = new URL("/auth", siteUrl).toString();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo },
  });

  if (error) {
    return NextResponse.redirect(new URL("/auth/signup?error=signup_failed", request.url), 303);
  }

  if (!data.session) {
    return NextResponse.redirect(new URL("/auth?message=check_email", request.url), 303);
  }

  return NextResponse.redirect(new URL("/workspace", request.url), 303);
}
