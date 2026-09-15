"use client";

import React, { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatMoneyMinor } from "@/lib/format";
import {
  useDynamicReportFilterOptions,
  emptyDynamicReportFilters,
  type DynamicReportFilterState,
  type DynamicReportFilterOption,
} from "@/hooks/use-dynamic-report-filter-options";

type StatementKey = "balance" | "income" | "oci" | "cash" | "equity";
type CompareMode = "none" | "previous" | "2_previous" | "3_previous";

type ReportState = {
  start: string;
  end: string;
  compare: CompareMode;
  cashMethod: "direct" | "indirect";
};

type AccountMeta = {
  id: string;
  code: string;
  name: string;
  account_type: string | null;
  statement_section: string | null;
  statement_subclassification: string | null;
  parent_account_id: string | null;
  is_contra: boolean;
};

type AccountLine = AccountMeta & {
  balance: number;
  compare?: number;
  period?: number;
  opening?: number;
};

const supabase = getSupabaseBrowserClient();

const names: Record<StatementKey, string> = {
  balance: "قائمة المركز المالي",
  income: "قائمة الربح أو الخسارة",
  oci: "الدخل الشامل الآخر",
  cash: "التدفقات النقدية",
  equity: "التغيرات في حقوق الملكية",
};

const emptyFilters = emptyDynamicReportFilters;

const pad = (n: number) => String(n).padStart(2, "0");

const localIso = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const fromIso = (v: string) => {
  const [y, m, d] = v.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const addDays = (d: Date, n: number) => {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  r.setDate(r.getDate() + n);
  return r;
};

const emptyState: ReportState = {
  start: "",
  end: "",
  compare: "none",
  cashMethod: "indirect",
};

function DateMenu({
  state,
  setState,
}: {
  state: ReportState;
  setState: (v: ReportState) => void;
}) {
  const [open, setOpen] = useState(false);

  const today = new Date();
  const anchor = state.end ? fromIso(state.end) : today;

  const apply = (s: Date, e: Date) => {
    setState({
      ...state,
      start: localIso(s),
      end: localIso(e),
    });
    setOpen(false);
  };

  const monthStart = new Date(
    anchor.getFullYear(),
    anchor.getMonth(),
    1
  );

  const monthEnd = new Date(
    anchor.getFullYear(),
    anchor.getMonth() + 1,
    0
  );

  const prevMonth = new Date(
    anchor.getFullYear(),
    anchor.getMonth() - 1,
    1
  );

  const quarterStart = new Date(
    anchor.getFullYear(),
    Math.floor(anchor.getMonth() / 3) * 3,
    1
  );

  const quarterEnd = new Date(
    anchor.getFullYear(),
    Math.floor(anchor.getMonth() / 3) * 3 + 3,
    0
  );

  const yearStart = new Date(anchor.getFullYear(), 0, 1);
  const yearEnd = new Date(anchor.getFullYear(), 11, 31);

  const items: [string, () => void][] = [
    ["اليوم", () => apply(today, today)],

    [
      "أمس",
      () => {
        const d = addDays(today, -1);
        apply(d, d);
      },
    ],

    ["هذا الشهر", () => apply(monthStart, monthEnd)],

    [
      "الشهر السابق",
      () =>
        apply(
          new Date(prevMonth.getFullYear(), prevMonth.getMonth(), 1),
          new Date(
            prevMonth.getFullYear(),
            prevMonth.getMonth() + 1,
            0
          )
        ),
    ],

    ["هذا الربع", () => apply(quarterStart, quarterEnd)],

    ["هذه السنة", () => apply(yearStart, yearEnd)],

    [
      "كل البيانات",
      () => {
        setState({
          ...state,
          start: "",
          end: "",
        });
        setOpen(false);
      },
    ],
  ];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="min-h-9 border border-slate-300 bg-white px-3 text-xs font-bold"
      >
        الفترة: {state.start || "كل البيانات"}
        {state.end ? ` — ${state.end}` : ""}
        ⌄
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-64 border border-slate-300 bg-white shadow-xl">
          {items.map(([label, action]) => (
            <button
              key={label}
              type="button"
              onClick={action}
              className="block w-full border-b px-4 py-3 text-right text-xs last:border-0"
            >
              {label}
            </button>
          ))}

          <div className="border-t bg-slate-50 p-3">
            <input
              type="date"
              value={state.start}
              onChange={(e) =>
                setState({
                  ...state,
                  start: e.target.value,
                })
              }
              className="mb-2 min-h-9 w-full border bg-white px-2 text-xs"
            />

            <input
              type="date"
              value={state.end}
              onChange={(e) =>
                setState({
                  ...state,
                  end: e.target.value,
                })
              }
              className="min-h-9 w-full border bg-white px-2 text-xs"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function CompareMenu({
  state,
  setState,
}: {
  state: ReportState;
  setState: (v: ReportState) => void;
}) {
  const [open, setOpen] = useState(false);

  const label =
    state.compare === "none"
      ? "مقارنة"
      : state.compare === "previous"
        ? "الفترة السابقة"
        : state.compare === "2_previous"
          ? "فترتان سابقتان"
          : "3 فترات سابقة";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="min-h-9 border border-slate-300 bg-white px-3 text-xs font-bold"
      >
        {label}⌄
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-56 border border-slate-300 bg-white shadow-xl">
          {(
            [
              ["none", "بلا مقارنة"],
              ["previous", "الفترة السابقة"],
              ["2_previous", "فترتان سابقتان"],
              ["3_previous", "3 فترات سابقة"],
            ] as const
          ).map(([value, text]) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setState({
                  ...state,
                  compare: value,
                });
                setOpen(false);
              }}
              className="block w-full border-b px-4 py-3 text-right text-xs"
            >
              {text}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterMenu({
  options,
  filters,
  setFilters,
  loading,
}: {
  options: Record<string, DynamicReportFilterOption[]>;
  filters: DynamicReportFilterState;
  setFilters: (v: DynamicReportFilterState) => void;
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);

  const fields: [
    keyof DynamicReportFilterState,
    string,
    DynamicReportFilterOption[]
  ][] = [
    ["branch", "الفرع", options.branches || []],
    ["department", "القسم", options.departments || []],
    ["costCenter", "مركز التكلفة", options.cost_centers || []],
    ["region", "المنطقة", options.regions || []],
    ["product", "المنتج", options.products || []],
    ["project", "المشروع", options.projects || []],
    ["account", "الحساب", options.accounts || []],
  ];

  const count = Object.values(filters).filter(Boolean).length;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`min-h-9 border px-3 text-xs font-bold ${
          count
            ? "border-slate-950 bg-slate-950 text-white"
            : "border-slate-300 bg-white"
        }`}
      >
        الأبعاد{count ? ` · ${count}` : ""}⌄
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-[min(94vw,520px)] border border-slate-300 bg-white p-4 shadow-xl">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-bold">أبعاد التقرير</span>

            <span className="text-[10px] text-slate-400">
              {loading
                ? "جاري تحديث الخيارات..."
                : "مرتبطة بالبيانات"}
            </span>

            <button
              type="button"
              onClick={() => setFilters(emptyFilters)}
              className="text-[11px] font-bold text-slate-500"
            >
              مسح الكل
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {fields.map(([key, label, items]) => (
              <label
                key={key}
                className="text-[11px] font-bold text-slate-500"
              >
                {label}

                <select
                  value={filters[key]}
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      [key]: e.target.value,
                    })
                  }
                  className="mt-1 min-h-9 w-full border border-slate-300 bg-white px-2 text-xs"
                >
                  <option value="">الكل</option>

                  {items.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          <p className="mt-3 text-[10px] leading-5 text-slate-400">
            كل اختيار يعيد حساب الخيارات المتاحة للأبعاد الأخرى
            تلقائيًا، مع إبقاء الاختيار الحالي صالحًا.
          </p>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  compare,
  level = 0,
  total = false,
  muted = false,
  double = false,
}: {
  label: string;
  value: any;
  compare?: any;
  level?: number;
  total?: boolean;
  muted?: boolean;
  double?: boolean;
}) {
  return (
    <div
      className={`grid grid-cols-[1fr_180px_180px] items-center border-b border-slate-100 py-2.5 text-sm ${
        total ? "font-bold" : ""
      } ${muted ? "text-slate-500" : ""} ${
        double ? "border-t-2 border-slate-300" : ""
      }`}
    >
      <span
        style={{
          paddingRight: `${level * 22}px`,
        }}
      >
        {label}
      </span>

      <span className="text-left tabular-nums">
        {formatMoneyMinor(value)}
      </span>

      <span className="text-left tabular-nums text-slate-400">
        {compare === undefined
          ? "—"
          : formatMoneyMinor(compare)}
      </span>
    </div>
  );
}

function StatementHeader() {
  return (
    <div className="grid grid-cols-[1fr_180px_180px] border-b-2 border-slate-900 pb-2 text-[11px] font-bold text-slate-500">
      <span>البيان</span>
      <span className="text-left">الفترة الحالية</span>
      <span className="text-left">المقارنة</span>
    </div>
  );
}

function Box({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-slate-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-bold text-slate-950">
        {title}
      </h3>

      <StatementHeader />

      {children}
    </section>
  );
}

/**
 * يعرض شجرة الحسابات بناءً على parent_account_id.
 *
 * مهم:
 * - لا يعرض code للمستخدم.
 * - يستخدم code فقط للترتيب الداخلي.
 * - الحسابات الأب تظهر كعناوين/إجماليات.
 * - الحسابات التابعة تظهر أسفل الحساب الأب بمستوى إزاحة مناسب.
 */
function AccountTree({
  accounts,
  excludeRootNames = [],
}: {
  accounts: AccountLine[];
  excludeRootNames?: string[];
}) {
  const byParent = useMemo(() => {
    const map = new Map<string | null, AccountLine[]>();

    for (const account of accounts) {
      const parent = account.parent_account_id ?? null;

      if (!map.has(parent)) {
        map.set(parent, []);
      }

      map.get(parent)!.push(account);
    }

    for (const list of map.values()) {
      list.sort((a, b) =>
        a.code.localeCompare(b.code, undefined, {
          numeric: true,
        })
      );
    }

    return map;
  }, [accounts]);

  const visibleAccounts = accounts.filter(
    (account) => !excludeRootNames.includes(account.name)
  );

  const visibleIds = new Set(
    visibleAccounts.map((account) => account.id)
  );

  const render = (
    parentId: string | null,
    level: number
  ): React.ReactNode => {
    const children = (byParent.get(parentId) || []).filter(
      (account) => visibleIds.has(account.id)
    );

    return children.map((account) => {
      const childAccounts = (byParent.get(account.id) || []).filter(
        (child) => visibleIds.has(child.id)
      );

      const hasChildren = childAccounts.length > 0;

      return (
        <React.Fragment key={account.id}>
          <Row
            label={account.name}
            value={account.balance}
            compare={account.compare}
            level={level}
            total={hasChildren}
          />

          {hasChildren &&
            render(account.id, level + 1)}
        </React.Fragment>
      );
    });
  };

  /**
   * بعض البيانات قد تحتوي على حسابات أبناء بدون أن يكون
   * الحساب الأب ضمن المجموعة المرسلة للقائمة.
   *
   * لذلك نعتبر أي حساب ليس له أب موجود داخل المجموعة Root
   * بدل فقدانه من التقرير.
   */
  const roots = visibleAccounts.filter(
    (account) =>
      !account.parent_account_id ||
      !visibleIds.has(account.parent_account_id)
  );

  return (
    <>
      {roots
        .sort((a, b) =>
          a.code.localeCompare(b.code, undefined, {
            numeric: true,
          })
        )
        .map((account) => {
          const children = (byParent.get(account.id) || []).filter(
            (child) => visibleIds.has(child.id)
          );

          const hasChildren = children.length > 0;

          return (
            <React.Fragment key={account.id}>
              <Row
                label={account.name}
                value={account.balance}
                compare={account.compare}
                level={0}
                total={hasChildren}
              />

              {hasChildren &&
                render(account.id, 1)}
            </React.Fragment>
          );
        })}
    </>
  );
}

function sectionTree(
  accounts: AccountLine[],
  section: string
) {
  return accounts.filter(
    (a) =>
      a.statement_section === section ||
      (section === "الإيرادات" &&
        a.statement_subclassification === "revenue") ||
      (section === "تكلفة المبيعات" &&
        a.statement_subclassification === "cogs") ||
      (section === "المصروفات التشغيلية" &&
        a.statement_subclassification ===
          "operating_expense")
  );
}

function IncomeStatement({
  accounts,
  data,
}: {
  accounts: AccountLine[];
  data: any;
}) {
  const revenue = sectionTree(accounts, "الإيرادات");

  const cogs = sectionTree(
    accounts,
    "تكلفة المبيعات"
  );

  const opex = sectionTree(
    accounts,
    "المصروفات التشغيلية"
  );

  const other = accounts.filter((a) =>
    [
      "other_income",
      "other_expense",
      "finance_cost",
      "tax",
    ].includes(a.statement_subclassification || "")
  );

  const total = (xs: AccountLine[]) =>
    xs
      .filter(
        (a) =>
          !xs.some(
            (child) =>
              child.parent_account_id === a.id
          )
      )
      .reduce(
        (s, a) => s + Number(a.balance || 0),
        0
      );

  const rev = Number(
    data?.revenue || total(revenue)
  );

  const cost = Number(
    data?.cogs || total(cogs)
  );

  const op = Number(
    data?.operating_expenses ||
      total(opex)
  );

  return (
    <div className="space-y-4 p-4">
      <Box title="قائمة الربح أو الخسارة">
        <Row
          label="الإيرادات"
          value={rev}
          compare={revenue.reduce(
            (s, a) =>
              s + Number(a.compare || 0),
            0
          )}
          total
        />

        <AccountTree
          accounts={revenue.filter(
            (a) =>
              a.statement_subclassification !==
                "revenue" ||
              a.parent_account_id !== null
          )}
        />

        <Row
          label="إجمالي الإيرادات"
          value={rev}
          total
          double
        />

        <Row
          label="تكلفة المبيعات"
          value={cost}
          compare={cogs.reduce(
            (s, a) =>
              s + Number(a.compare || 0),
            0
          )}
          total
        />

        <AccountTree
          accounts={cogs.filter(
            (a) =>
              a.statement_subclassification !==
                "cogs" ||
              a.parent_account_id !== null
          )}
        />

        <Row
          label="مجمل الربح"
          value={Number(
            data?.gross_profit ??
              rev - cost
          )}
          total
          double
        />

        <Row
          label="المصروفات التشغيلية"
          value={op}
          compare={opex.reduce(
            (s, a) =>
              s + Number(a.compare || 0),
            0
          )}
          total
        />

        <AccountTree
          accounts={opex.filter(
            (a) =>
              a.statement_subclassification !==
                "operating_expense" ||
              a.parent_account_id !== null
          )}
        />

        <Row
          label="الربح التشغيلي"
          value={Number(
            data?.ebit ??
              rev - cost - op
          )}
          total
          double
        />

        {other.length > 0 && (
          <>
            <Row
              label="بنود أخرى وتمويل وضريبة"
              value={other.reduce(
                (s, a) =>
                  s + Number(a.balance || 0),
                0
              )}
              total
            />

            <AccountTree
              accounts={other}
            />
          </>
        )}

        <Row
          label="صافي الربح أو الخسارة"
          value={Number(
            data?.net_income || 0
          )}
          total
          double
        />
      </Box>
    </div>
  );
}

function BalanceSheet({
  data,
  comparison,
}: {
  data: any;
  comparison: any;
}) {
  const accounts =
    (data?.accounts || []) as AccountLine[];

  const cmp = new Map<string, AccountLine>(
    (comparison?.accounts || []).map(
      (x: AccountLine) => [x.id, x]
    )
  );

  const merged = accounts.map((account) => ({
    ...account,
    compare:
      cmp.get(account.id)?.balance,
  }));

  const assets = merged.filter(
    (a) => a.account_type === "asset"
  );

  const liabilities = merged.filter(
    (a) => a.account_type === "liability"
  );

  const equity = merged.filter(
    (a) => a.account_type === "equity"
  );

  /**
   * نحدد الحسابات الرئيسية داخل شجرة الأصول.
   * لا نعرض الحساب الجذر "الأصول" مرة ثانية لأن عنوان
   * القسم موجود بالفعل أعلى القائمة.
   */
  const assetRoots = assets.filter(
    (a) => !a.parent_account_id
  );

  const liabilityRoots = liabilities.filter(
    (a) => !a.parent_account_id
  );

  const equityRoots = equity.filter(
    (a) => !a.parent_account_id
  );

  return (
    <div className="space-y-4 p-4">
      <Box title="قائمة المركز المالي">

        {/* ================= الأصول ================= */}

        <Row
          label="الأصول"
          value={data?.total_assets}
          total
        />

        <AccountTree
          accounts={assets}
          excludeRootNames={assetRoots
            .filter(
              (a) =>
                a.name === "الأصول" ||
                a.name === "الاصول"
            )
            .map((a) => a.name)}
        />

        <Row
          label="إجمالي الأصول"
          value={data?.total_assets}
          total
          double
        />

        {/* ================= الالتزامات ================= */}

        <Row
          label="الالتزامات"
          value={data?.total_liabilities}
          total
        />

        <AccountTree
          accounts={liabilities}
          excludeRootNames={liabilityRoots
            .filter(
              (a) =>
                a.name === "الالتزامات" ||
                a.name === "الالتزامات وحقوق الملكية"
            )
            .map((a) => a.name)}
        />

        <Row
          label="إجمالي الالتزامات"
          value={data?.total_liabilities}
          total
          double
        />

        {/* ================= حقوق الملكية ================= */}

        <Row
          label="حقوق الملكية"
          value={data?.total_equity}
          total
        />

        <AccountTree
          accounts={equity}
          excludeRootNames={equityRoots
            .filter(
              (a) =>
                a.name === "حقوق الملكية" ||
                a.name === "حقوق المساهمين"
            )
            .map((a) => a.name)}
        />

        <Row
          label="إجمالي حقوق الملكية"
          value={data?.total_equity}
          total
          double
        />

        <Row
          label="إجمالي الالتزامات وحقوق الملكية"
          value={
            Number(
              data?.total_liabilities || 0
            ) +
            Number(
              data?.total_equity || 0
            )
          }
          total
          double
        />
      </Box>
    </div>
  );
}

function Report({
  kind,
  data,
  comparison,
  accountLines,
}: {
  kind: StatementKey;
  data: any;
  comparison: any;
  accountLines: AccountLine[];
}) {
  if (kind === "balance") {
    return (
      <BalanceSheet
        data={data}
        comparison={comparison}
      />
    );
  }

  if (kind === "income") {
    return (
      <IncomeStatement
        accounts={accountLines}
        data={data}
      />
    );
  }

  if (kind === "cash") {
    return (
      <div className="grid gap-4 p-4 md:grid-cols-3">
        <Box title="التدفقات التشغيلية">
          <Row
            label="صافي التدفق من الأنشطة التشغيلية"
            value={
              data?.operating
                ?.net_operating_cash_flow
            }
            compare={
              comparison?.operating
                ?.net_operating_cash_flow
            }
            total
          />
        </Box>

        <Box title="التدفقات الاستثمارية">
          <Row
            label="صافي التدفق من الأنشطة الاستثمارية"
            value={
              data?.investing?.net_cash_flow
            }
            compare={
              comparison?.investing?.net_cash_flow
            }
            total
          />
        </Box>

        <Box title="التدفقات التمويلية">
          <Row
            label="صافي التدفق من الأنشطة التمويلية"
            value={
              data?.financing?.net_cash_flow
            }
            compare={
              comparison?.financing?.net_cash_flow
            }
            total
          />
        </Box>

        <div className="md:col-span-3">
          <Box title="التغير في النقد وما في حكمه">
            <Row
              label="النقد أول الفترة"
              value={data?.opening_cash}
              compare={
                comparison?.opening_cash
              }
            />

            <Row
              label="صافي التغير في النقد"
              value={data?.net_change}
              compare={
                comparison?.net_change
              }
            />

            <Row
              label="النقد آخر الفترة"
              value={data?.closing_cash}
              compare={
                comparison?.closing_cash
              }
              total
              double
            />
          </Box>
        </div>
      </div>
    );
  }

  if (kind === "oci") {
    return (
      <div className="p-4">
        <Box title="الدخل الشامل الآخر">
          <AccountTree
            accounts={accountLines.filter(
              (a) =>
                a.statement_subclassification ===
                "other_comprehensive_income"
            )}
          />

          <Row
            label="إجمالي الدخل الشامل الآخر"
            value={
              data?.period?.total || 0
            }
            compare={
              comparison?.period?.total
            }
            total
            double
          />
        </Box>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <Box title="التغيرات في حقوق الملكية">
        <AccountTree
          accounts={accountLines.filter(
            (a) => a.account_type === "equity"
          )}
        />
      </Box>

      <Box title="الإجماليات">
        <Row
          label="صافي الربح للفترة"
          value={data?.ytd_net_income}
          compare={
            comparison?.ytd_net_income
          }
        />

        <Row
          label="حقوق الملكية الختامية"
          value={
            data?.displayed_closing_equity
          }
          compare={
            comparison?.displayed_closing_equity
          }
          total
          double
        />
      </Box>
    </div>
  );
}

export default function FinancialStatementsPage() {
  const [org, setOrg] = useState("");
  const [active, setActive] =
    useState<StatementKey>("balance");

  const [states, setStates] =
    useState<Record<
      StatementKey,
      ReportState
    >>({
      balance: { ...emptyState },
      income: { ...emptyState },
      oci: { ...emptyState },
      cash: { ...emptyState },
      equity: { ...emptyState },
    });

  const [filters, setFilters] =
    useState<DynamicReportFilterState>(
      emptyFilters
    );

  const [data, setData] =
    useState<any>(null);

  const [comparison, setComparison] =
    useState<any>(null);

  const [accountLines, setAccountLines] =
    useState<AccountLine[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const state = states[active];

  const setState = (value: ReportState) =>
    setStates((s) => ({
      ...s,
      [active]: value,
    }));

  useEffect(() => {
    const id =
      window.sessionStorage.getItem(
        "activeOrganizationId"
      ) ||
      window.localStorage.getItem(
        "activeOrganizationId"
      ) ||
      "";

    setOrg(id);

    if (!id) {
      setLoading(false);
      return;
    }

    void supabase
      .from("financial_periods")
      .select(
        "period_start,period_end"
      )
      .eq("organization_id", id)
      .order("period_end", {
        ascending: false,
      })
      .limit(1)
      .then(({ data: p }) => {
        const last = p?.[0];

        if (last) {
          setStates(
            (v) =>
              Object.fromEntries(
                (
                  Object.keys(
                    names
                  ) as StatementKey[]
                ).map((k) => [
                  k,
                  {
                    ...v[k],
                    start:
                      last.period_start,
                    end:
                      last.period_end,
                  },
                ])
              ) as Record<
                StatementKey,
                ReportState
              >
          );
        }
      });
  }, []);

  const {
    options,
    loading: optionsLoading,
    error: optionsError,
  } = useDynamicReportFilterOptions(
    org,
    filters,
    {
      start: state.start,
      end: state.end,
    }
  );

  useEffect(() => {
    if (optionsError) {
      setError(optionsError);
    }
  }, [optionsError]);

  const comparisonRange = useMemo(() => {
    if (
      state.compare === "none" ||
      !state.start ||
      !state.end
    ) {
      return null;
    }

    const s = fromIso(state.start);
    const e = fromIso(state.end);

    const days = Math.max(
      1,
      Math.round(
        (e.getTime() - s.getTime()) /
          86400000
      ) + 1
    );

    const n =
      state.compare === "previous"
        ? 1
        : state.compare === "2_previous"
          ? 2
          : 3;

    return {
      start: localIso(
        addDays(s, -days * n)
      ),
      end: localIso(
        addDays(
          s,
          -days * (n - 1) - 1
        )
      ),
    };
  }, [
    state.compare,
    state.start,
    state.end,
  ]);

  useEffect(() => {
    if (
      !org ||
      !state.start ||
      !state.end
    ) {
      return;
    }

    let cancelled = false;

    void (async () => {
      setLoading(true);
      setError("");

      const args = {
        p_organization_id: org,
        p_start_date: state.start,
        p_end_date: state.end,
        p_journal_no: null,
        p_cash_flow_method:
          state.cashMethod,
        p_branch_id:
          filters.branch || null,
        p_department_id:
          filters.department || null,
        p_cost_center_id:
          filters.costCenter || null,
        p_region_id:
          filters.region || null,
        p_product_id:
          filters.product || null,
        p_project_id:
          filters.project || null,
        p_account_id:
          filters.account || null,
      };

      const a = await supabase.rpc(
        "get_financial_statements_date_range_filtered",
        args
      );

      if (cancelled) {
        return;
      }

      if (a.error) {
        setError(a.error.message);
        setLoading(false);
        return;
      }

      setData(a.data);

      if (comparisonRange) {
        const b = await supabase.rpc(
          "get_financial_statements_date_range_filtered",
          {
            ...args,
            p_start_date:
              comparisonRange.start,
            p_end_date:
              comparisonRange.end,
          }
        );

        if (!cancelled) {
          if (b.error) {
            setError(b.error.message);
          }

          setComparison(
            b.data || null
          );
        }
      } else {
        setComparison(null);
      }

      const base =
        await supabase
          .from("accounts")
          .select(
            "id,code,name,account_type,statement_section,statement_subclassification,parent_account_id,is_contra"
          )
          .eq(
            "organization_id",
            org
          )
          .order("code", {
            ascending: true,
          });

      if (base.error) {
        if (!cancelled) {
          setError(
            base.error.message
          );
        }

        setLoading(false);
        return;
      }

      const loadLines = async (
        start: string,
        end: string
      ) => {
        let q = supabase
          .from("financial_facts")
          .select(
            "account_id,debit_minor,credit_minor"
          )
          .eq(
            "organization_id",
            org
          )
          .eq(
            "fact_type",
            "actual"
          )
          .eq(
            "status",
            "published"
          )
          .gte(
            "transaction_date",
            start
          )
          .lte(
            "transaction_date",
            end
          );

        if (filters.branch) {
          q = q.eq(
            "branch_id",
            filters.branch
          );
        }

        if (filters.department) {
          q = q.eq(
            "department_id",
            filters.department
          );
        }

        if (filters.costCenter) {
          q = q.eq(
            "cost_center_id",
            filters.costCenter
          );
        }

        if (filters.region) {
          q = q.eq(
            "region_id",
            filters.region
          );
        }

        if (filters.product) {
          q = q.eq(
            "product_id",
            filters.product
          );
        }

        if (filters.project) {
          q = q.eq(
            "project_id",
            filters.project
          );
        }

        if (filters.account) {
          q = q.eq(
            "account_id",
            filters.account
          );
        }

        const {
          data: facts,
          error: e,
        } = await q.limit(50000);

        if (e) {
          throw e;
        }

        const sums =
          new Map<string, number>();

        for (const f of facts || []) {
          const meta =
            (base.data || []).find(
              (x: any) =>
                x.id === f.account_id
            );

          if (!meta) {
            continue;
          }

          const debit = Number(
            f.debit_minor || 0
          );

          const credit = Number(
            f.credit_minor || 0
          );

          const raw = [
            "revenue",
            "liability",
            "equity",
          ].includes(
            meta.account_type
          )
            ? credit - debit
            : debit - credit;

          const value = meta.is_contra
            ? -raw
            : raw;

          sums.set(
            f.account_id,
            (sums.get(
              f.account_id
            ) || 0) + value
          );
        }

        return sums;
      };

      const currentSums =
        await loadLines(
          state.start,
          state.end
        );

      const previousSums =
        comparisonRange
          ? await loadLines(
              comparisonRange.start,
              comparisonRange.end
            )
          : new Map<string, number>();

      const meta =
        (base.data || []) as AccountMeta[];

      const lines = meta
        .filter(
          (a) =>
            ["revenue", "expense"].includes(
              a.account_type || ""
            ) ||
            a.statement_subclassification ===
              "other_comprehensive_income"
        )
        .map((a) => ({
          ...a,
          balance:
            currentSums.get(a.id) || 0,
          compare:
            previousSums.get(a.id),
        }));

      if (!cancelled) {
        setAccountLines(lines);
      }

      setLoading(false);
    })().catch((e) => {
      if (!cancelled) {
        setError(
          e?.message ||
            "تعذر تحميل تفاصيل الحسابات"
        );

        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    org,
    state.start,
    state.end,
    state.cashMethod,
    comparisonRange,
    filters.branch,
    filters.department,
    filters.costCenter,
    filters.region,
    filters.product,
    filters.project,
    filters.account,
  ]);

  const key =
    active === "balance"
      ? "balance_sheet"
      : active === "income"
        ? "income_statement"
        : active === "cash"
          ? "cash_flow"
          : active === "equity"
            ? "equity_statement"
            : "other_comprehensive_income";

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-[#f7f8fa] text-slate-900"
    >
      <div className="mx-auto w-full px-4 py-5 sm:px-6">
        <header className="border-b border-slate-200 pb-4">
          <p className="text-[10px] font-bold tracking-[.16em] text-slate-400">
            FINANCIAL REPORTING
          </p>

          <h1 className="mt-1 text-2xl font-bold text-slate-950">
            القوائم المالية
          </h1>

          <p className="mt-1 text-xs text-slate-500">
            عرض هرمي وتجميع للحسابات وفق
            تصنيف القوائم المالية والمعايير
            المعتمدة
          </p>
        </header>

        <div className="mt-3 flex flex-wrap items-center gap-1 border-b border-slate-200 bg-white px-2 py-2">
          <DateMenu
            state={state}
            setState={setState}
          />

          <CompareMenu
            state={state}
            setState={setState}
          />

          <FilterMenu
            options={options}
            filters={filters}
            setFilters={setFilters}
            loading={optionsLoading}
          />

          {active === "cash" && (
            <select
              value={state.cashMethod}
              onChange={(e) =>
                setState({
                  ...state,
                  cashMethod:
                    e.target.value as
                      | "direct"
                      | "indirect",
                })
              }
              className="min-h-9 border border-slate-300 bg-white px-3 text-xs"
            >
              <option value="indirect">
                التدفقات — غير مباشر
              </option>

              <option value="direct">
                التدفقات — مباشر
              </option>
            </select>
          )}
        </div>

        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-500">
          <span className="border border-slate-200 bg-white px-3 py-1.5">
            من {state.start || "كل البيانات"} إلى{" "}
            {state.end || "كل البيانات"}
          </span>

          {comparisonRange && (
            <span className="border border-slate-200 bg-white px-3 py-1.5">
              مقارنة: {comparisonRange.start} إلى{" "}
              {comparisonRange.end}
            </span>
          )}
        </div>

        <div className="mt-3 overflow-x-auto border border-slate-200 bg-white">
          <div className="flex min-w-max">
            {(
              Object.keys(
                names
              ) as StatementKey[]
            ).map((k) => (
              <button
                type="button"
                key={k}
                onClick={() => setActive(k)}
                className={`border-l border-slate-200 px-4 py-3 text-xs font-bold ${
                  active === k
                    ? "border-b-2 border-b-slate-950 text-slate-950"
                    : "text-slate-400"
                }`}
              >
                {names[k]}
              </button>
            ))}
          </div>

          {error && (
            <div className="m-3 border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex min-h-72 items-center justify-center text-sm text-slate-500">
              جارٍ تحميل القائمة المالية…
            </div>
          ) : (
            <Report
              kind={active}
              data={data?.[key]}
              comparison={comparison?.[key]}
              accountLines={accountLines}
            />
          )}
        </div>
      </div>
    </main>
  );
}
