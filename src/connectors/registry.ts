import type { AtsSource, Job, SourceKind } from '@/lib/types';
import { supabaseConfigured, supabaseRequest } from '@/lib/supabase-rest';
import { ashbyAdapter } from './ashby';
import { greenhouseAdapter } from './greenhouse';
import { leverAdapter } from './lever';
import { fetchJobicyJobs } from './jobicy';
import type { JobSourceAdapter } from './job-source';

const adapters: Record<SourceKind, JobSourceAdapter> = {
  greenhouse: greenhouseAdapter,
  lever: leverAdapter,
  ashby: ashbyAdapter,
};

const DEFAULT_SOURCES: AtsSource[] = [
  { kind: 'ashby', key: 'cohere', company: 'Cohere', enabled: true },
  { kind: 'ashby', key: 'ashby', company: 'Ashby', enabled: true },
  { kind: 'ashby', key: 'magical', company: 'Magical', enabled: true },
  { kind: 'ashby', key: 'terminal', company: 'Terminal', enabled: true },
  { kind: 'ashby', key: 'runbook', company: 'Runbook', enabled: true },
  { kind: 'lever', key: 'stackadapt', company: 'StackAdapt', enabled: true },
  { kind: 'lever', key: 'getmaple', company: 'Maple', enabled: true },
  { kind: 'lever', key: 'wealthsimple', company: 'Wealthsimple', enabled: true },
  { kind: 'lever', key: 'applydigital', company: 'APPLY', enabled: true },
  { kind: 'greenhouse', key: 'clutch', company: 'Clutch', enabled: true },
];

function envSources(kind: SourceKind, name: string): AtsSource[] {
  const value = process.env[name];
  if (!value) return [];
  return value.split(',').map((part: string) => part.trim()).filter(Boolean).map((key: string) => ({ kind, key, company: key, enabled: true }));
}

async function databaseSources(): Promise<AtsSource[]> {
  if (!supabaseConfigured) return [];
  try {
    const rows = await supabaseRequest<Array<{ kind: SourceKind; source_key: string; company: string; enabled: boolean }>>('job_sources?select=kind,source_key,company,enabled');
    return rows.map((row) => ({ kind: row.kind, key: row.source_key, company: row.company, enabled: row.enabled }));
  } catch {
    return [];
  }
}

export async function configuredSources() {
  const extra = [
    ...envSources('greenhouse', 'GREENHOUSE_BOARDS'),
    ...envSources('lever', 'LEVER_SITES'),
    ...envSources('ashby', 'ASHBY_BOARDS'),
    ...(await databaseSources()),
  ];
  const merged = new Map<string, AtsSource>();
  for (const source of [...DEFAULT_SOURCES, ...extra]) merged.set(`${source.kind}:${source.key}`, source);
  return [...merged.values()].filter((source) => source.enabled !== false);
}

export async function discoverJobs() {
  const sources = await configuredSources();
  const atsSettled = await Promise.allSettled(sources.map(async (source) => ({ source, jobs: await adapters[source.kind].fetch(source) })));
  const jobicySettled = await Promise.allSettled([fetchJobicyJobs()]);
  const jobs: Job[] = [];
  const errors: string[] = [];

  for (const result of atsSettled) {
    if (result.status === 'fulfilled') jobs.push(...result.value.jobs);
    else errors.push(result.reason instanceof Error ? result.reason.message : String(result.reason));
  }
  for (const result of jobicySettled) {
    if (result.status === 'fulfilled') jobs.push(...result.value);
    else errors.push(result.reason instanceof Error ? result.reason.message : String(result.reason));
  }

  const deduped = new Map(jobs.map((job) => [job.id ?? `${job.source}:${job.sourceKey}:${job.externalId}`, job]));
  return { jobs: [...deduped.values()], errors, sources: sources.length + 1 };
}
