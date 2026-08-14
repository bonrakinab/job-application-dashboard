import type { AnswerBankEntry } from '@/lib/types';
import { deleteAnswerBankEntry, listAnswerBank, saveAnswerBankEntry } from '@/lib/store';

export async function GET() {
  return Response.json(await listAnswerBank());
}

export async function POST(request: Request) {
  try {
    const entry = await request.json() as AnswerBankEntry;
    if (!entry.question?.trim()) return Response.json({ error: 'Question is required.' }, { status: 400 });
    await saveAnswerBankEntry({ ...entry, tags: Array.isArray(entry.tags) ? entry.tags : [] });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return Response.json({ error: 'id is required.' }, { status: 400 });
  await deleteAnswerBankEntry(id);
  return Response.json({ ok: true });
}
