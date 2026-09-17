import { createClient } from "@supabase/supabase-js";

// Public Supabase configuration for the FPA SaaS project.
// Environment variables remain the preferred production configuration.
// The publishable key is safe for browser use; never use a secret/service-role key here.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://qnoulgkttxvnqdiisevv.supabase.co";
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_1VEncF0WwxH9JqeAeGWBrg_EiwCBQ9X";

const rpcInFlight = new Map<string, Promise<Response>>();

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

  const key = `${request.method}|${request.url}|${body}`;
  const existing = rpcInFlight.get(key);
  if (existing) return (await existing).clone();

  const pending = fetch(request);
  rpcInFlight.set(key, pending);
  try {
    return (await pending).clone();
  } finally {
    rpcInFlight.delete(key);
  }
};

let browserClient: ReturnType<typeof createClient> | null = null;

export function getSupabaseBrowserClient() {
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
    });
  }

  return browserClient;
}
