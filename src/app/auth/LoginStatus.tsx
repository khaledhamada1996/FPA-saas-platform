"use client";

import { useEffect, useMemo, useState } from "react";

type Props = {
  error?: string;
  message?: string;
  retry?: string;
  attempts?: string;
};

export default function LoginStatus({ error, message, retry, attempts }: Props) {
  const initialSeconds = useMemo(() => Math.max(0, Number.parseInt(retry ?? "0", 10) || 0), [retry]);
  const [seconds, setSeconds] = useState(initialSeconds);

  useEffect(() => {
    setSeconds(initialSeconds);
  }, [initialSeconds]);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = window.setInterval(() => {
      setSeconds((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [seconds]);

  if (message === "check_email") {
    return (
      <div className="auth-alert" role="status">
        تم إنشاء الحساب بنجاح. افتح رسالة التأكيد المرسلة إلى بريدك الإلكتروني ثم ارجع وسجّل الدخول.
      </div>
    );
  }

  if (error === "too_many_attempts" && seconds > 0) {
    const minutes = Math.floor(seconds / 60);
    const remaining = seconds % 60;
    return (
      <div className="auth-alert auth-alert-error" role="alert">
        <strong>تم إيقاف تسجيل الدخول مؤقتًا</strong>
        <span>تم تجاوز 3 محاولات دخول غير صحيحة. يمكنك المحاولة مرة أخرى بعد</span>
        <strong dir="ltr">{minutes}:{remaining.toString().padStart(2, "0")}</strong>
      </div>
    );
  }

  if (error === "too_many_attempts") {
    return <div className="auth-alert auth-alert-error" role="alert">انتهى الإيقاف المؤقت. يمكنك المحاولة مرة أخرى.</div>;
  }

  if (error === "email_not_confirmed") {
    return (
      <div className="auth-alert auth-alert-error" role="alert">
        <strong>البريد الإلكتروني غير مؤكد</strong>
        <span>افتح رسالة التأكيد في بريدك الإلكتروني ثم حاول تسجيل الدخول مرة أخرى.</span>
      </div>
    );
  }

  if (error === "invalid_credentials") {
    const remaining = Math.max(0, 3 - (Number.parseInt(attempts ?? "1", 10) || 1));
    return (
      <div className="auth-alert auth-alert-error" role="alert">
        <strong>بيانات الدخول غير صحيحة</strong>
        <span>المحاولات المتبقية قبل الإيقاف المؤقت: {remaining}</span>
      </div>
    );
  }

  if (error === "security_unavailable") {
    return <div className="auth-alert auth-alert-error" role="alert">تعذر التحقق من حماية تسجيل الدخول. حاول مرة أخرى بعد قليل.</div>;
  }

  if (error === "signup_failed") {
    return <div className="auth-alert auth-alert-error" role="alert">تعذر إنشاء الحساب. تأكد من البريد الإلكتروني وكلمة المرور ثم حاول مرة أخرى.</div>;
  }

  return null;
}
