'use client';

import { useEffect } from 'react';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('application render error', error);
  }, [error]);

  return <div className="login">
    <div className="login-card">
      <div className="eyebrow">Temporary loading issue</div>
      <h1>Couldn’t load this page</h1>
      <p className="sub">A server-side dependency did not respond correctly. Your saved profile, applications and documents were not changed.</p>
      <div className="row" style={{ marginTop: 18 }}>
        <button className="btn primary" type="button" onClick={() => reset()}>Try again</button>
        <a className="btn ghost" href="/">Dashboard</a>
      </div>
      {error.digest ? <p className="small muted" style={{ marginTop: 16 }}>Error reference: {error.digest}</p> : null}
    </div>
  </div>;
}
