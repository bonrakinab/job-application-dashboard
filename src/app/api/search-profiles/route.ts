import type { SearchProfile } from '@/lib/types';
import { deleteSearchProfile, listSearchProfiles, saveSearchProfile } from '@/lib/store';

function validId(value: string) {
  return /^[a-z0-9][a-z0-9-]{1,48}$/.test(value);
}

export async function GET() {
  return Response.json(await listSearchProfiles());
}

export async function POST(request: Request) {
  try {
    const profile = await request.json() as SearchProfile;
    if (!validId(profile.id ?? '')) return Response.json({ error: 'Use a short lowercase id with letters, numbers and hyphens.' }, { status: 400 });
    if (!profile.name?.trim()) return Response.json({ error: 'Name is required.' }, { status: 400 });
    await saveSearchProfile({
      ...profile,
      description: profile.description ?? '',
      targetTitles: Array.isArray(profile.targetTitles) ? profile.targetTitles : [],
      includeKeywords: Array.isArray(profile.includeKeywords) ? profile.includeKeywords : [],
      minMatch: Number.isFinite(Number(profile.minMatch)) ? Number(profile.minMatch) : 65,
      enabled: profile.enabled !== false,
    });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return Response.json({ error: 'id is required.' }, { status: 400 });
  await deleteSearchProfile(id);
  return Response.json({ ok: true });
}
