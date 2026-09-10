import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/auth", request.url), 303);

  const form = await request.formData();
  const name = String(form.get("name") ?? "").trim();
  const currency = String(form.get("currency") ?? "SAR").toUpperCase();
  const fiscalYearStartMonth = Number(form.get("fiscalMonth") ?? 1);

  if (name.length < 2 || name.length > 120 || !/^[A-Z]{3}$/.test(currency) || !Number.isInteger(fiscalYearStartMonth) || fiscalYearStartMonth < 1 || fiscalYearStartMonth > 12) {
    return NextResponse.redirect(new URL("/workspace?error=invalid_workspace", request.url), 303);
  }

  const { error } = await supabase.rpc("create_workspace", {
    p_name: name,
    p_base_currency: currency,
    p_fiscal_year_start_month: fiscalYearStartMonth,
  });

  if (error) {
    return NextResponse.redirect(new URL("/workspace?error=workspace_creation_failed", request.url), 303);
  }

  return NextResponse.redirect(new URL("/dashboard", request.url), 303);
}
