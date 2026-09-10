export default function WorkspacePage() {
  return (
    <main className="auth-page" dir="rtl">
      <section className="auth-card workspace-card">
        <div className="auth-mark">ق</div>
        <p className="eyebrow">الخطوة الأولى</p>
        <h1>أنشئ مساحة عمل شركتك</h1>
        <p>
          ابدأ باستخدام المنصة مباشرة في مساحة العمل التجريبية. سيتم ربطها بالحساب وقاعدة البيانات عند تفعيل التسجيل لاحقًا.
        </p>

        <div className="auth-form">
          <label>
            اسم الشركة
            <input type="text" placeholder="مثال: شركة النماء التجارية" autoComplete="organization" />
          </label>

          <label>
            العملة الأساسية
            <select defaultValue="SAR">
              <option value="SAR">ريال سعودي (SAR)</option>
              <option value="AED">درهم إماراتي (AED)</option>
              <option value="KWD">دينار كويتي (KWD)</option>
              <option value="QAR">ريال قطري (QAR)</option>
              <option value="BHD">دينار بحريني (BHD)</option>
              <option value="OMR">ريال عُماني (OMR)</option>
            </select>
          </label>

          <label>
            بداية السنة المالية
            <select defaultValue="1">
              {Array.from({ length: 12 }, (_, index) => (
                <option key={index + 1} value={index + 1}>
                  {index + 1}
                </option>
              ))}
            </select>
          </label>

          <a href="/dashboard" className="primary-button" role="button">
            إنشاء مساحة العمل
          </a>
        </div>
      </section>
    </main>
  );
}
