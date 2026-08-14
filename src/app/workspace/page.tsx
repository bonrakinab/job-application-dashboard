const tools = [
  {
    href: '/insights',
    title: 'Career insights',
    description: 'See which skills and role families are appearing most often in your job market.',
    action: 'View insights',
  },
  {
    href: '/search-profiles',
    title: 'Saved searches',
    description: 'Manage AI/ML, software, IT, data, automation and ERP/Oracle search profiles.',
    action: 'Manage searches',
  },
  {
    href: '/target-jobs',
    title: 'Target company jobs',
    description: 'Review openings specifically from employers on your target-company watchlist.',
    action: 'View target jobs',
  },
  {
    href: '/companies',
    title: 'Target companies',
    description: 'Maintain your employer watchlist and company-level intelligence.',
    action: 'Manage companies',
  },
  {
    href: '/answer-bank',
    title: 'Answer bank',
    description: 'Store approved answers for recurring application questions and reuse them safely.',
    action: 'Open answer bank',
  },
  {
    href: '/automations',
    title: 'Automations',
    description: 'Optional n8n or webhook connections for job-match and application-status events.',
    action: 'Manage automations',
  },
];

export default function WorkspacePage() {
  return <>
    <div className="topbar simple-topbar">
      <div>
        <div className="eyebrow">Advanced tools</div>
        <h1 className="title">Workspace</h1>
        <div className="sub">Less-used tools are grouped here so the main navigation stays focused on finding and applying to jobs.</div>
      </div>
    </div>

    <div className="workspace-grid">
      {tools.map((tool) => <a className="card workspace-card" href={tool.href} key={tool.href}>
        <div>
          <h2>{tool.title}</h2>
          <p className="muted small">{tool.description}</p>
        </div>
        <span className="workspace-link">{tool.action} →</span>
      </a>)}
    </div>
  </>;
}
