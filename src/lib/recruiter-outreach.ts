import { supabaseConfigured, supabaseRequest, upsertRows } from './supabase-rest';

export const outreachStages = ['To contact', 'Contacted', 'Connected', 'Conversation', 'Referred', 'Closed'] as const;
export type OutreachRecord = { stage: string; notes: string; due: string; activities: { at: string; channel: string; note: string }[]; custom?: Record<string, unknown>; archived?: boolean };
export function validateOutreach(value: unknown): { id: string; record: OutreachRecord } {
  if (!value || typeof value !== 'object') throw new Error('Contact data is required.');
  const b = value as { id?: unknown; record?: unknown };
  if (typeof b.id !== 'string' || !/^[a-zA-Z0-9_-]{1,200}$/.test(b.id)) throw new Error('Invalid contact ID.');
  if (!b.record || typeof b.record !== 'object' || JSON.stringify(b.record).length > 50000) throw new Error('Invalid tracking data.');
  const r = b.record as OutreachRecord;
  if (!outreachStages.includes(r.stage as typeof outreachStages[number]) || typeof r.notes !== 'string' || r.notes.length > 15000 || typeof r.due !== 'string' || (r.due && !/^\d{4}-\d{2}-\d{2}$/.test(r.due))) throw new Error('Invalid stage, notes or follow-up date.');
  if (!Array.isArray(r.activities) || r.activities.length > 500 || r.activities.some(a => !a || typeof a.at !== 'string' || !Number.isFinite(Date.parse(a.at)) || typeof a.channel !== 'string' || typeof a.note !== 'string')) throw new Error('Invalid interaction history.');
  if (r.custom) {
    const c = r.custom;
    if (!b.id.startsWith('custom-') || c.id !== b.id || typeof c.name !== 'string' || !c.name.trim() || typeof c.company !== 'string' || !c.company.trim() || typeof c.title !== 'string' || typeof c.location !== 'string' || typeof c.source !== 'string' || typeof c.verification !== 'string' || !Array.isArray(c.domains) || c.domains.some(d => typeof d !== 'string')) throw new Error('Invalid custom contact.');
    for (const field of ['source', 'linkedin', 'photo']) if (c[field] && (typeof c[field] !== 'string' || !/^https?:\/\//i.test(String(c[field])))) throw new Error('Contact links must use HTTP or HTTPS.');
    if (c.email && (typeof c.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email))) throw new Error('Invalid professional email.');
  }
  // Allow only fields consumed by the UI; scope is fixed server-side.
  return { id: b.id, record: { stage: r.stage, notes: r.notes, due: r.due, activities: r.activities.map(a => ({at:a.at, channel:a.channel, note:a.note})), ...(r.custom ? {custom:r.custom} : {}), ...(typeof r.archived === 'boolean' ? {archived:r.archived} : {}) } };
}
export async function loadRecruiterOutreach() {
  if (!supabaseConfigured) throw new Error('JobAgent database is not configured.');
  const rows = await supabaseRequest<{contact_id:string;record:OutreachRecord}[]>('recruiter_outreach?profile_id=eq.default&select=contact_id,record&order=updated_at.desc&limit=1000');
  return rows.map(r => ({id:r.contact_id,...r.record}));
}
export async function saveRecruiterOutreach(id: string, record: OutreachRecord) {
  if (!supabaseConfigured) throw new Error('JobAgent database is not configured.');
  await upsertRows('recruiter_outreach', [{profile_id:'default',contact_id:id,record,updated_at:new Date().toISOString()}], 'profile_id,contact_id');
}
