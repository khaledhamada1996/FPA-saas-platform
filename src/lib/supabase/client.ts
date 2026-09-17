import { createClient } from "@supabase/supabase-js";

// Public Supabase configuration for the FPA SaaS project.
// Environment variables remain the preferred production configuration.
// The publishable key is safe for browser use; never use a secret/service-role key here.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://qnoulgkttxvnqdiisevv.supabase.co";
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "sb_publishable_1VEncF0WwxH9JqeAeGWBrg_EiwCBQ9X";

const rpcInFlight = new Map<string, Promise<Response>>();
const rpcCache = new Map<string, { expiresAt: number; body: string; status: number; statusText: string; headers: [string, string][] }>();
const RPC_CACHE_TTL_MS = 5000;
const READ_ONLY_RPC_CACHE = new Set([
  "get_financial_statements_date_range_filtered",
  "get_financial_statement_account_lines",
  "get_dynamic_reporting_filter_options",
  "get_workspace_profile",
  "get_activity_reporting_blueprint",
]);

const getRequestBody = (body: BodyInit | null | undefined) => {
  if (typeof body === "string") return body;
  if (body instanceof URLSearchParams) return body.toString();
  return null;
};

const dedupeRpcFetch: typeof fetch = async (input, init) => {
  const request = new Request(input, init);
  const isRpc = request.method === "POST" && request.url.includes("/rest/v1/rpc/");
  if (!isRpc) return fetch(request);

  const body = getRequestBody(init?.body ?? null);
  if (body === null) return fetch(request);

  const functionName = request.url.split("/rest/v1/rpc/")[1]?.split("?")[0] || "";
  const auth = request.headers.get("authorization") || "";
  const key = `${request.method}|${request.url}|${auth}|${body}`;
  const now = Date.now();

  if (READ_ONLY_RPC_CACHE.has(functionName)) {
    const cached = rpcCache.get(key);
    if (cached && cached.expiresAt > now) {
      return new Response(cached.body, {
        status: cached.status,
        statusText: cached.statusText,
        headers: cached.headers,
      });
    }
    if (cached) rpcCache.delete(key);
  }

  const existing = rpcInFlight.get(key);
  if (existing) return (await existing).clone();

  const pending = fetch(request);
  rpcInFlight.set(key, pending);
  try {
    const response = await pending;
    if (READ_ONLY_RPC_CACHE.has(functionName) && response.ok) {
      const bodyText = await response.clone().text();
      rpcCache.set(key, {
        expiresAt: now + RPC_CACHE_TTL_MS,
        body: bodyText,
        status: response.status,
        statusText: response.statusText,
        headers: Array.from(response.headers.entries()),
      });
    }
    return response.clone();
  } finally {
    rpcInFlight.delete(key);
  }
};

type BrowserSupabaseClient = Omit<ReturnType<typeof createClient>, "rpc"> & {
  // The generated Supabase RPC overloads can lag behind database migrations.
  // Keep normal client typing while allowing runtime-validated RPC signatures.
  rpc: (...args: any[]) => any;
};

let browserClient: BrowserSupabaseClient | null = null;

export function getSupabaseBrowserClient(): BrowserSupabaseClient {
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error("Supabase client configuration is unavailable");
  }

  if (!browserClient) {
    browserClient = createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
      global: {
        fetch: dedupeRpcFetch,
      },
    }) as BrowserSupabaseClient;
  }

  return browserClient;
}
