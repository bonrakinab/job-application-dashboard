'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function DiscoverButton() {
  const [busy,setBusy]=useState(false); const [message,setMessage]=useState(''); const router=useRouter();
  async function run(){setBusy(true);setMessage('');try{const r=await fetch('/api/jobs/discover',{method:'POST'});const j=await r.json();if(!r.ok)throw new Error(j.error||'Discovery failed');setMessage(`${j.relevant} relevant · ${j.analyzed.length} analyzed`);router.refresh();}catch(e){setMessage(e instanceof Error?e.message:String(e));}finally{setBusy(false)}}
  return <div className="row"><button className="btn primary" disabled={busy} onClick={run}>{busy?'Running…':'Run discovery'}</button>{message?<span className="small muted">{message}</span>:null}</div>;
}
