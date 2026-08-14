import { collapseDuplicateJobs } from '@/lib/job-duplicates';
import { sendDigest } from '@/lib/gmail';
import { listJobs, logActivity } from '@/lib/store';

export const runtime = 'nodejs';
export const maxDuration = 300;

function authorizedCron(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) return request.headers.get('authorization') === `Bearer ${secret}`;
  return request.headers.get('user-agent')?.toLowerCase().includes('vercel-cron/1.0') ?? false;
}

export async function GET(request: Request) {
  if (!authorizedCron(request)) return new Response('Unauthorized', { status: 401 });
  try {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const recentRaw = (await listJobs(500)).filter((job) => {
      const discovered = job.discoveredAt ? Date.parse(job.discoveredAt) : 0;
      return discovered >= cutoff && !['closed', 'likely_closed'].includes(job.validityStatus ?? 'unknown');
    });
    const collapsed = collapseDuplicateJobs(recentRaw);
    const recent = collapsed.jobs;
    const jobs = recent
      .filter((job) => job.match && ['exceptional', 'strong', 'reasonable'].includes(job.match.recommendation))
      .sort((a, b) => (b.match?.overall ?? 0) - (a.match?.overall ?? 0) || (b.healthScore ?? 50) - (a.healthScore ?? 50))
      .slice(0, 12);
    const strongCount = recent.filter((job) => job.match && ['exceptional', 'strong'].includes(job.match.recommendation)).length;
    const lines = jobs.map((job, index) => `${index + 1}. ${job.title} — ${job.company} (${job.location ?? 'location not listed'})\n   Match: ${job.match?.overall}/100 · ${job.match?.recommendation}\n   Posting health: ${job.healthScore ?? 50}/100 · ${job.validityStatus ?? 'unknown'}\n   ${job.applyUrl || job.url}`);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    const text = [
      'Job Agent daily insights',
      `New unique viable listings in the last 24 hours: ${recent.length}.`,
      collapsed.groups.length ? `${recentRaw.length - recent.length} duplicate record(s) were collapsed before this digest.` : '',
      `Recommended new matches: ${jobs.length}. Strong / exceptional among new listings: ${strongCount}.`,
      '',
      ...lines,
      '',
      appUrl ? `Dashboard: ${appUrl}/recommended` : '',
    ].filter(Boolean).join('\n');
    const mail = await sendDigest(`Job Agent: ${jobs.length} new matches`, text);
    await logActivity('cron.daily.completed', undefined, { newListings: recent.length, duplicatesCollapsed: recentRaw.length - recent.length, digestJobs: jobs.length, strongCount, mailSkipped: mail.skipped });
    return Response.json({ ok: true, newListings: recent.length, duplicatesCollapsed: recentRaw.length - recent.length, digestJobs: jobs.length, strongCount, mail });
  } catch (error) {
    await logActivity('cron.daily.failed', undefined, { error: error instanceof Error ? error.message : String(error) });
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
