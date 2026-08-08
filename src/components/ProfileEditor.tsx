'use client';
import { useState } from 'react';
import type { CandidateProfile } from '@/lib/types';

export function ProfileEditor({ initial }: { initial: CandidateProfile }) {
  const [text,setText]=useState(JSON.stringify(initial,null,2)); const [msg,setMsg]=useState(''); const [busy,setBusy]=useState(false);
  async function save(){setBusy(true);setMsg('');try{const profile=JSON.parse(text);const r=await fetch('/api/profile',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(profile)});const j=await r.json();if(!r.ok)throw new Error(j.error||'Save failed');setMsg('Profile saved to Supabase.');}catch(e){setMsg(e instanceof Error?e.message:String(e));}finally{setBusy(false)}}
  return <div><textarea className="textarea" value={text} onChange={e=>setText(e.target.value)}/><div className="row" style={{marginTop:10}}><button className="btn primary" onClick={save} disabled={busy}>{busy?'Saving…':'Save profile'}</button><span className="small muted">{msg}</span></div></div>;
}
