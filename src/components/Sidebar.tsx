const primaryLinks = [
  { href: '/', label: 'Overview', icon: '⌂' },
  { href: '/recommended', label: 'Find Jobs', icon: '★' },
  { href: '/fresh-openings', label: 'Fresh openings', icon: '✦' },
  { href: '/applications', label: 'Applications', icon: '◎' },
  { href: '/workspace', label: 'Workspace', icon: '◫' },
  { href: '/settings', label: 'Settings', icon: '⚙' },
];

function NavigationLinks({ className }: { className: string }) {
  return <nav className={className} aria-label="Primary navigation">
    {primaryLinks.map((link) => <a href={link.href} key={link.href}>
      <span aria-hidden="true">{link.icon}</span>{' '}
      <span>{link.label}</span>
    </a>)}
  </nav>;
}

export function Sidebar() {
  return <>
    <aside className="sidebar">
      <a className="brand" href="/" aria-label="Job Agent dashboard">JOB<span>AGENT</span></a>
      <NavigationLinks className="nav" />
      <div className="side-foot">Six main areas. Advanced tools stay inside Workspace instead of crowding the navigation.</div>
    </aside>

    <header className="mobile-header">
      <a className="brand mobile-brand" href="/" aria-label="Job Agent dashboard">JOB<span>AGENT</span></a>
      <details className="mobile-menu">
        <summary aria-label="Open navigation menu">
          <span>Menu</span>
          <span className="mobile-menu-icon" aria-hidden="true">☰</span>
        </summary>
        <div className="mobile-menu-panel">
          <NavigationLinks className="mobile-nav" />
          <div className="mobile-menu-note">Overview → fresh openings → find jobs → apply → track. Everything else lives in Workspace.</div>
        </div>
      </details>
    </header>
  </>;
}
