const baseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)?.replace(/\/$/, '');
const apiKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseConfigured = Boolean(baseUrl && apiKey);

const READ_ATTEMPTS = 3;
const REQUEST_TIMEOUT_MS = 3500;
const RETRY_DELAYS_MS = [150, 450];

function headers(extra?: HeadersInit) {
  if (!apiKey) throw new Error('Supabase secret key is not configured.');
  return {
    apikey: apiKey,
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    ...extra,
  } as HeadersInit;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isRetryableSupabaseStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function isReadRequest(init: RequestInit) {
  const method = String(init.method ?? 'GET').toUpperCase();
  return method === 'GET' || method === 'HEAD';
}

function requestSignal(external?: AbortSignal | null) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  if (external) {
    if (external.aborted) controller.abort();
    else external.addEventListener('abort', onAbort, { once: true });
  }
  return {
    signal: controller.signal,
    cleanup() {
      clearTimeout(timeout);
      external?.removeEventListener('abort', onAbort);
    },
  };
}

export async function supabaseRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!baseUrl || !apiKey) throw new Error('Supabase is not configured.');

  const read = isReadRequest(init);
  const attempts = read ? READ_ATTEMPTS : 1;
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const timed = requestSignal(init.signal);
    try {
      const response = await fetch(`${baseUrl}/rest/v1/${path}`, {
        ...init,
        headers: headers(init.headers),
        cache: 'no-store',
        signal: timed.signal,
      });

      if (!response.ok) {
        const body = await response.text();
        const error = new Error(`Supabase ${response.status}: ${body.slice(0, 600)}`);
        if (read && isRetryableSupabaseStatus(response.status) && attempt < attempts - 1) {
          lastError = error;
          await sleep(RETRY_DELAYS_MS[attempt] ?? 500);
          continue;
        }
        throw error;
      }

      if (response.status === 204) return undefined as T;
      const text = await response.text();
      return (text ? JSON.parse(text) : undefined) as T;
    } catch (error) {
      if (init.signal?.aborted) throw error;
      const transientNetworkError = error instanceof TypeError
        || (error instanceof Error && (error.name === 'AbortError' || /fetch failed|network|timeout/i.test(error.message)));
      if (read && transientNetworkError && attempt < attempts - 1) {
        lastError = error;
        await sleep(RETRY_DELAYS_MS[attempt] ?? 500);
        continue;
      }
      throw error;
    } finally {
      timed.cleanup();
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Supabase request failed after retries.');
}

export async function upsertRows<T>(table: string, rows: unknown[], onConflict?: string): Promise<T[]> {
  if (!rows.length) return [];
  const conflict = onConflict ? `?on_conflict=${encodeURIComponent(onConflict)}` : '';
  return supabaseRequest<T[]>(`${table}${conflict}`, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(rows),
  });
}

export async function insertRows<T>(table: string, rows: unknown[]): Promise<T[]> {
  if (!rows.length) return [];
  return supabaseRequest<T[]>(table, {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(rows),
  });
}

export async function insertIgnoreRows<T>(table: string, rows: unknown[], onConflict?: string): Promise<T[]> {
  if (!rows.length) return [];
  const conflict = onConflict ? `?on_conflict=${encodeURIComponent(onConflict)}` : '';
  return supabaseRequest<T[]>(`${table}${conflict}`, {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
    body: JSON.stringify(rows),
  });
}

export async function patchRows<T>(path: string, values: unknown): Promise<T[]> {
  return supabaseRequest<T[]>(path, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(values),
  });
}

export async function deleteRows<T>(path: string): Promise<T[]> {
  return supabaseRequest<T[]>(path, {
    method: 'DELETE',
    headers: { Prefer: 'return=representation' },
  });
}
