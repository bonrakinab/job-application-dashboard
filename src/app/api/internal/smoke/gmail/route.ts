import { createOutreachDraft, gmailConfigStatus, validateGmailOAuth } from '@/lib/gmail';
import { verifyGitHubActionsOidc } from '@/lib/github-actions-oidc';
import { getApplicationPack, listJobs, logActivity } from '@/lib/store';

export const runtime = 'nodejs';
export const maxDuration = 120;

const COMPLETED_EVENT = 'production.gmail_smoke.completed';

export async function POST(request: Request) {
  try {
    await verifyGitHubActionsOidc(request);

    const config = gmailConfigStatus();
    if (!config.oauth) throw new Error('Gmail OAuth environment variables are not fully configured.');

    await validateGmailOAuth();

    const jobs = await listJobs(200);
    let selected: (typeof jobs)[number] | undefined;
    let pack: Awaited<ReturnType<typeof getApplicationPack>> | undefined;

    for (const job of jobs) {
      if (!job.id) continue;
      const candidatePack = await getApplicationPack(job.id);
      if (!candidatePack) continue;
      selected = job;
      pack = candidatePack;
      break;
    }

    if (!selected?.id || !pack) throw new Error('No generated application pack is available for the Gmail smoke test.');

    const draft = await createOutreachDraft(
      `[Job Agent smoke] ${selected.title} — ${selected.company}`,
      pack.outreachMessage,
    );

    const payload = {
      jobId: selected.id,
      company: selected.company,
      title: selected.title,
      draftCreated: Boolean(draft.id),
      draftId: draft.id ?? null,
      createdAt: new Date().toISOString(),
    };
    await logActivity(COMPLETED_EVENT, selected.id, payload);

    return Response.json({ ok: true, ...payload });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    try {
      await logActivity('production.gmail_smoke.failed', undefined, { message, failedAt: new Date().toISOString() });
    } catch {
      // Preserve the primary Gmail failure if activity logging also fails.
    }
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
