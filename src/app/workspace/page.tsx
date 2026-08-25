const tools = [
  {
    href: '/insights',
    title: 'Skills insights',
    description: 'See common skills and learning gaps.',
    action: 'Open',
  },
  {
    href: '/search-profiles',
    title: 'Saved searches',
    description: 'Save focused searches for different types of roles.',
    action: 'Open',
  },
  {
    href: '/target-jobs',
    title: 'Target company jobs',
    description: 'Review jobs from employers you follow.',
    action: 'Open',
  },
  {
    href: '/companies',
    title: 'Target companies',
    description: 'Find and manage employers you want to follow.',
    action: 'Open',
  },
  {
    href: '/answer-bank',
    title: 'Answer bank',
    description: 'Save reusable answers to common application questions.',
    action: 'Open',
  },
  {
    href: '/automations',
    title: 'Automations',
    description: 'Connect optional external workflows.',
    action: 'Open',
  },
];

export default function WorkspacePage() {
  return <>
    <div className="topbar simple-topbar">
      <div>
        <h1 className="title">More tools</h1>
        <div className="sub">Extra tools that support your job search.</div>
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
