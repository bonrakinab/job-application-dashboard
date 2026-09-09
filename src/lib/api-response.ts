// Hosting errors can have an empty or HTML body. Preserve the HTTP status
// instead of replacing the useful failure with a JSON parser exception.
export async function readApiResponse<T>(response: Response, action: string): Promise<T> {
  const body = await response.text();
  let payload: unknown;
  try { payload = JSON.parse(body); } catch { /* Handled below. */ }
  const object = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? payload as Record<string, unknown> : undefined;
  if (!response.ok || !object) {
    if (typeof object?.error === 'string' && object.error.trim()) throw new Error(object.error);
    const reason = response.status === 401
      ? 'Your session has expired. Sign in again.'
      : response.status === 504 || response.status === 408
        ? 'The server timed out. Refresh the job to check whether the documents were saved before retrying.'
        : `${action} returned ${body.trim() ? 'an unreadable' : 'an empty'} response. Refresh the job and try again.`;
    throw new Error(`${reason} (HTTP ${response.status})`);
  }
  return object as T;
}
