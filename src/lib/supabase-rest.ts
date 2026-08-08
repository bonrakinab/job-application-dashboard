const baseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)?.replace(/\/$/, '');
const apiKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseConfigured = Boolean(baseUrl && apiKey);

function headers(extra?: HeadersInit) {
  if (!apiKey) throw new Error('Supabase secret key is not configured.');
  return {
    apikey: apiKey,
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    ...extra,
  } as HeadersInit;
}

export async function supabaseRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!baseUrl || !apiKey) throw new Error('Supabase is not configured.');
  const response = await fetch(`${baseUrl}/rest/v1/${path}`, {
    ...init,
    headers: headers(init.headers),
    cache: 'no-store',
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase ${response.status}: ${body.slice(0, 600)}`);
  }
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
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
