import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://qnoulgkttxvnqdiisevv.supabase.co";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_1VEncF0WwxH9JqeAeGWBrg_EiwCBQ9X";
const GEMINI_MODEL = "gemini-2.5-flash";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return jsonError("غير مصرح بالوصول.", 401);

  let body: { organizationId?: string; periodId?: string; question?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError("بيانات الطلب غير صالحة.");
  }

  const organizationId = body.organizationId?.trim();
  const periodId = body.periodId?.trim();
  const question = body.question?.trim();
  if (!organizationId || !periodId || !question) return jsonError("الشركة والفترة والسؤال مطلوبة.");
  if (question.length > 2000) return jsonError("السؤال طويل جدًا. الحد الأقصى 2000 حرف.");

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: context, error: contextError } = await supabase.rpc("get_ai_financial_context", {
    p_organization_id: organizationId,
    p_period_id: periodId,
  });
  if (contextError) return jsonError(contextError.message, contextError.code === "PGRST301" ? 401 : 403);

  const contextObject = context as Record<string, unknown> | null;
  if (!contextObject || contextObject.status !== "ready") return jsonError("لا تتوفر بيانات مالية جاهزة للتحليل.", 422);

  const keys = [
    process.env.GEMINI_API_KEY_1,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
  ].filter((key): key is string => Boolean(key));
  if (!keys.length) return jsonError("لم يتم إعداد مفتاح Gemini على الخادم.", 503);

  const systemInstruction = `أنت محلل مالي داخل منصة FP&A. مهمتك تفسير البيانات المالية المقدمة فقط، وليس إجراء تعديلات على النظام أو إصدار قيود محاسبية.\n\nقواعد إلزامية:\n1) السياق المالي المرفق هو المصدر الوحيد للأرقام. لا تخترع أي رقم أو فترة أو حساب أو سبب غير موجود.\n2) الحسابات والمؤشرات الأساسية صادرة من محركات مالية حتمية؛ لا تعِد حسابها بطريقة قد تغير النتيجة.\n3) إذا كانت البيانات غير كافية للإجابة، صرّح بذلك بوضوح واذكر ما ينقص.\n4) ميّز بوضوح بين الحقيقة المستخرجة من البيانات، والاستنتاج التحليلي، والتوصية.\n5) لا تدّعي تنفيذ أي إجراء أو تغيير أي بيانات.\n6) أجب بالعربية الواضحة والمهنية، واستخدم الأرقام والنسب كما وردت في السياق.\n7) لا تعرض أي معلومات تخص شركة أو فترة خارج السياق المقدم.\n8) اجعل الإجابة عملية ومختصرة نسبيًا، مع عناوين ونقاط عند الحاجة.`;

  let lastError = "فشل الاتصال بخدمة التحليل الذكي.";
  for (const key of keys) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(key)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: [{ role: "user", parts: [{ text: `السؤال:\n${question}\n\nالسياق المالي الموثوق (JSON):\n${JSON.stringify(contextObject)}` }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 1200 },
        }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        lastError = `Gemini ${response.status}: ${errorText.slice(0, 240)}`;
        continue;
      }
      const result = await response.json() as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const answer = result.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
      if (!answer) {
        lastError = "لم تُرجع خدمة التحليل إجابة نصية.";
        continue;
      }
      return NextResponse.json({ answer, model: GEMINI_MODEL, source: "deterministic_financial_engines" });
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError;
    }
  }

  return jsonError(lastError, 502);
}
