import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return NextResponse.redirect(new URL("/auth/signup?error=signup_failed", request.url), 303);
  }

  if (!data.session) {
    return NextResponse.redirect(new URL("/auth?message=check_email", request.url), 303);
  }

  return NextResponse.redirect(new URL("/workspace", request.url), 303);
}
